package service

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/dushixiang/uart_sms_forwarder/config"
	"github.com/dushixiang/uart_sms_forwarder/internal/models"
	"github.com/go-orz/cache"
	"github.com/google/uuid"
	"github.com/jpillora/backoff"
	"go.bug.st/serial"
	"go.uber.org/zap"
)

const (
	// 缓存键
	CacheKeyDeviceStatus = "device_status"
	// 缓存刷新间隔
	CacheRefreshInterval = 30 * time.Second
	// 缓存过期时间
	CacheTTL = 5 * time.Minute
)

// SerialService 串口管理服务
type SerialService struct {
	logger          *zap.Logger
	config          config.SerialConfig
	port            serial.Port
	textMsgService  *TextMessageService
	notifier        *Notifier
	propertyService *PropertyService
	ctx             context.Context
	cancel          context.CancelFunc
	wg              sync.WaitGroup
	// 设备信息缓存
	deviceCache cache.Cache[string, *StatusData]
	// 连接状态管理
	mu        sync.RWMutex
	portName  string // 当前使用的串口名称
	connected bool   // 连接状态
}

// NewSerialService 创建串口服务实例
func NewSerialService(
	logger *zap.Logger,
	config config.SerialConfig,
	textMsgService *TextMessageService,
	notifier *Notifier,
	propertyService *PropertyService,
) *SerialService {
	return &SerialService{
		logger:          logger,
		config:          config,
		textMsgService:  textMsgService,
		notifier:        notifier,
		propertyService: propertyService,
		deviceCache:     cache.New[string, *StatusData](CacheTTL),
	}
}

// Start 启动串口服务（使用 backoff 重连机制）
func (s *SerialService) Start(ctx context.Context) {
	s.ctx, s.cancel = context.WithCancel(ctx)

	// 启动主循环
	b := &backoff.Backoff{
		Min:    5 * time.Second,
		Max:    1 * time.Minute,
		Factor: 2,
		Jitter: true,
	}

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		err := s.runOnce(b.Reset)

		// 检查是否是上下文取消
		if s.ctx.Err() != nil {
			s.logger.Info("收到停止信号，串口服务退出")
			return
		}

		// 连接失败或断开，使用 backoff 重试
		if err != nil {
			s.setConnected(false)
			retryAfter := b.Duration()
			s.logger.Warn("串口连接异常，将重试",
				zap.Error(err),
				zap.Duration("retry_after", retryAfter))

			select {
			case <-time.After(retryAfter):
				continue
			case <-s.ctx.Done():
				return
			}
		}
	}
}

// setConnected 设置连接状态
func (s *SerialService) setConnected(connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connected = connected
}

// setPortName 设置串口名称
func (s *SerialService) setPortName(portName string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.portName = portName
}

// getConnectionInfo 获取连接信息
func (s *SerialService) getConnectionInfo() (portName string, connected bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.portName, s.connected
}

// runOnce 执行一次连接尝试
func (s *SerialService) runOnce(resetBackoff func()) error {
	// 获取串口列表
	ports, err := serial.GetPortsList()
	if err != nil {
		return fmt.Errorf("获取串口列表失败: %w", err)
	}

	if len(ports) == 0 {
		return fmt.Errorf("未发现可用串口")
	}

	s.logger.Debug("发现可用串口", zap.Strings("ports", ports))

	// 确定使用的串口
	var selectedPort string
	if s.config.Port != "" {
		// 使用配置的串口
		selectedPort = s.config.Port
		s.logger.Info("使用配置的串口", zap.String("port", selectedPort))
	} else {
		// 自动检测
		s.logger.Info("开始自动检测串口...")
		selectedPort, err = s.autoDetectPort(ports)
		if err != nil {
			return fmt.Errorf("自动检测串口失败: %w", err)
		}
		s.logger.Info("自动检测到可用串口", zap.String("port", selectedPort))
	}

	// 连接串口
	if err := s.connectSerial(selectedPort); err != nil {
		return fmt.Errorf("连接串口失败: %w", err)
	}

	// 设置连接状态和串口名称
	s.setPortName(selectedPort)
	s.setConnected(true)

	// 重置 backoff（连接成功）
	resetBackoff()

	s.logger.Info("串口连接成功", zap.String("port", selectedPort))

	// 启动监听 goroutine
	s.wg.Add(1)
	go s.listenSerialData()

	// 启动定时更新缓存的 goroutine
	s.wg.Add(1)
	go s.periodicCacheUpdate()

	// 首次立即发送缓存更新请求
	go s.requestCacheUpdate()

	// 等待连接断开
	s.wg.Wait()
	return nil
}

// Stop 停止串口服务
func (s *SerialService) Stop() error {
	s.logger.Info("正在停止串口服务...")

	if s.cancel != nil {
		s.cancel()
	}

	s.wg.Wait()

	if s.port != nil {
		if err := s.port.Close(); err != nil {
			s.logger.Error("关闭串口失败", zap.Error(err))
			return err
		}
	}

	s.logger.Info("串口服务已停止")
	return nil
}

// connectSerial 连接串口
func (s *SerialService) connectSerial(portName string) error {
	mode := &serial.Mode{
		BaudRate: 115200,
		DataBits: 8,
		StopBits: serial.OneStopBit,
		Parity:   serial.NoParity,
	}

	port, err := serial.Open(portName, mode)
	if err != nil {
		return err
	}

	s.port = port
	return nil
}

// autoDetectPort 自动检测可用串口
func (s *SerialService) autoDetectPort(ports []string) (string, error) {
	for _, portName := range ports {
		s.logger.Debug("测试串口", zap.String("port", portName))

		mode := &serial.Mode{
			BaudRate: 115200,
			DataBits: 8,
			StopBits: serial.OneStopBit,
			Parity:   serial.NoParity,
		}

		port, err := serial.Open(portName, mode)
		if err != nil {
			s.logger.Debug("打开串口失败", zap.String("port", portName), zap.Error(err))
			continue
		}

		// 设置读取超时
		port.SetReadTimeout(1 * time.Second)

		// 发送测试命令（使用正确的协议格式）
		testCmd := map[string]string{"action": "get_status"}
		jsonData, _ := json.Marshal(testCmd)
		// 添加协议包围标志
		message := fmt.Sprintf("CMD_START:%s:CMD_END\r\n", string(jsonData))

		_, err = port.Write([]byte(message))
		if err != nil {
			port.Close()
			continue
		}

		// 等待响应
		time.Sleep(500 * time.Millisecond)

		buffer := make([]byte, 4096)
		n, err := port.Read(buffer)
		port.Close()

		if err == nil && n > 0 {
			response := string(buffer[:n])
			if s.isValidResponse(response) {
				s.logger.Debug("检测到可用串口", zap.String("port", portName))
				return portName, nil
			}
		}
	}

	return "", fmt.Errorf("未检测到可用串口")
}

// isValidResponse 检查响应是否有效
func (s *SerialService) isValidResponse(response string) bool {
	// 检查是否包含基本的JSON结构
	if !strings.Contains(response, "{") || !strings.Contains(response, "}") {
		return false
	}

	// 尝试解析JSON
	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(response), &jsonData); err == nil {
		if _, hasType := jsonData["type"]; hasType {
			return true
		}
		if _, hasTimestamp := jsonData["timestamp"]; hasTimestamp {
			return true
		}
		if len(jsonData) > 0 {
			return true
		}
	}

	// 检查是否包含Lua脚本的标准格式
	if strings.Contains(response, "SMS_START:") && strings.Contains(response, ":SMS_END") {
		return true
	}

	// 检查是否包含状态信息关键词
	keywords := []string{"status_response", "mobile_info", "heartbeat", "system_ready"}
	for _, keyword := range keywords {
		if strings.Contains(response, keyword) {
			return true
		}
	}

	return false
}

// listenSerialData 监听串口数据（在独立 goroutine 中运行）
func (s *SerialService) listenSerialData() {
	defer s.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			s.logger.Error("串口监听 goroutine panic", zap.Any("recover", r))
		}
		// 关闭串口
		if s.port != nil {
			s.port.Close()
			s.port = nil
		}
	}()

	reader := bufio.NewReader(s.port)

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info("串口监听停止")
			return
		default:
			line, err := reader.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					// EOF 可能表示设备断开
					s.logger.Warn("串口读取 EOF，设备可能已断开")
					return
				}
				// 检查 context 是否已取消
				if s.ctx.Err() != nil {
					return
				}
				// 其他错误，可能是设备断开或硬件错误
				s.logger.Error("读取串口数据错误，退出监听", zap.Error(err))
				return
			}

			s.processReceivedData(strings.TrimSpace(line))
		}
	}
}

// periodicCacheUpdate 定时更新缓存
func (s *SerialService) periodicCacheUpdate() {
	defer s.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			s.logger.Error("定时更新缓存 goroutine panic", zap.Any("recover", r))
		}
	}()

	ticker := time.NewTicker(CacheRefreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info("停止定时更新缓存")
			return
		case <-ticker.C:
			s.requestCacheUpdate()
		}
	}
}

// requestCacheUpdate 请求更新缓存（只发送命令，不等待响应）
func (s *SerialService) requestCacheUpdate() {
	s.logger.Debug("发送缓存更新请求")

	// 发送获取设备状态命令（包含移动网络信息）
	if err := s.sendJSONCommand(map[string]string{"action": "get_status"}); err != nil {
		s.logger.Error("发送设备状态请求失败", zap.Error(err))
	}
}

type StatusData struct {
	CellularEnabled bool   `json:"cellular_enabled"`
	Type            string `json:"type"`
	Mobile          struct {
		IsRegistered bool   `json:"is_registered"`
		Iccid        string `json:"iccid"`
		NetworkType  string `json:"network_type"`
		SignalDesc   string `json:"signal_desc"`
		SignalLevel  int    `json:"signal_level"`
		SimReady     bool   `json:"sim_ready"`
		Rssi         int    `json:"rssi"`
		Imsi         string `json:"imsi"`
		Operator     string `json:"operator"`
	} `json:"mobile"`
	Timestamp int    `json:"timestamp"`
	MemKb     int    `json:"mem_kb"`
	PortName  string `json:"port_name"` // 串口名称
	Connected bool   `json:"connected"` // 连接状态
}

// processReceivedData 处理接收到的数据
func (s *SerialService) processReceivedData(data string) {
	s.logger.Sugar().Debugf("received data: %s", data)
	// 解析Lua脚本发送的消息格式：SMS_START:{json}:SMS_END
	if strings.HasPrefix(data, "SMS_START:") && strings.HasSuffix(data, ":SMS_END") {
		// 提取JSON部分
		jsonData := data[10 : len(data)-8]

		// 先解析为通用map来判断消息类型
		var msg map[string]interface{}
		if err := json.Unmarshal([]byte(jsonData), &msg); err != nil {
			s.logger.Error("JSON解析失败", zap.Error(err), zap.String("data", jsonData))
			return
		}

		// 根据type字段处理不同类型的消息
		msgType, ok := msg["type"].(string)
		if !ok {
			s.logger.Warn("消息类型缺失", zap.String("data", jsonData))
			return
		}

		switch msgType {
		case "incoming_sms":
			s.handleIncomingSMS(jsonData)
		case "system_ready":
			s.handleSystemReady(jsonData)
		case "heartbeat":
			s.handleHeartbeat(msg)
		case "status_response":
			// 直接更新缓存（status_response 包含完整的设备状态和 mobile 信息）
			// 更新运营商
			var statusData StatusData
			if err := json.Unmarshal([]byte(jsonData), &statusData); err != nil {
				s.logger.Error("JSON解析失败", zap.Error(err), zap.String("data", jsonData))
				return
			}
			imsi := statusData.Mobile.Imsi
			if len(imsi) > 5 {
				plmn := imsi[:5]
				statusData.Mobile.Operator = OperData[plmn]
			}
			s.deviceCache.Set(CacheKeyDeviceStatus, &statusData, CacheTTL)
			s.logger.Debug("设备状态缓存已更新")
		case "cellular_control_response":
			s.logger.Debug("收到蜂窝网络控制响应", zap.Any("data", msg))
		case "phone_number_response":
			s.logger.Debug("收到电话号码响应", zap.Any("data", msg))
		case "cmd_response":
			// Lua 脚本中的命令响应
			if action, ok := msg["action"].(string); ok {
				s.logger.Info("命令响应", zap.String("action", action), zap.Any("result", msg["result"]))
			}
		case "sms_send_result":
			// 短信发送结果
			s.handleSMSSendResult(msg)
		case "sim_event":
			// SIM卡事件
			status, _ := msg["status"].(string)
			s.logger.Info("SIM卡事件", zap.String("status", status))
		case "warning":
			// 警告消息（如数据连接警告）
			if warnMsg, ok := msg["msg"].(string); ok {
				s.logger.Warn("设备警告", zap.String("message", warnMsg))
			}
		case "error":
			// 错误消息
			if errMsg, ok := msg["msg"].(string); ok {
				s.logger.Error("设备错误", zap.String("message", errMsg))
			}
		default:
			s.logger.Debug("未知消息类型", zap.String("type", msgType), zap.String("data", jsonData))
		}
	}
}

// IncomingSMS 接收的短信消息结构
type IncomingSMS struct {
	Timestamp int64  `json:"timestamp"`
	From      string `json:"from"`
	Content   string `json:"content"`
	Type      string `json:"type"`
}

// handleIncomingSMS 处理接收到的短信
func (s *SerialService) handleIncomingSMS(jsonData string) {
	var sms IncomingSMS
	if err := json.Unmarshal([]byte(jsonData), &sms); err != nil {
		s.logger.Error("短信消息解析失败", zap.Error(err))
		return
	}

	s.logger.Info("收到新短信",
		zap.String("from", sms.From),
		zap.String("content", sms.Content),
		zap.Int64("timestamp", sms.Timestamp))

	// 保存短信记录
	ctx := context.Background()
	msg := &models.TextMessage{
		ID:        uuid.NewString(),
		From:      sms.From,
		To:        "", // 接收方是本机
		Content:   sms.Content,
		Type:      "incoming",
		Status:    "received",
		Timestamp: sms.Timestamp,
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := s.textMsgService.Save(ctx, msg); err != nil {
		s.logger.Error("保存短信记录失败", zap.Error(err))
	}

	// 异步发送通知
	go s.sendNotification(ctx, sms)
}

// sendNotification 发送通知
func (s *SerialService) sendNotification(ctx context.Context, sms IncomingSMS) {
	// 获取通知渠道配置
	channels, err := s.propertyService.GetNotificationChannelConfigs(ctx)
	if err != nil {
		s.logger.Error("获取通知渠道配置失败", zap.Error(err))
		return
	}

	// 格式化消息
	timestamp := time.Unix(sms.Timestamp, 0)
	message := fmt.Sprintf("📱 新短信 [%s]\n发送方: %s\n内容: %s",
		timestamp.Format("2006-01-02 15:04:05"),
		sms.From,
		sms.Content,
	)

	// 发送到所有启用的渠道
	for _, channel := range channels {
		if !channel.Enabled {
			continue
		}

		var sendErr error
		switch channel.Type {
		case "dingtalk":
			sendErr = s.notifier.SendDingTalkByConfig(ctx, channel.Config, message)
		case "wecom":
			sendErr = s.notifier.SendWeComByConfig(ctx, channel.Config, message)
		case "feishu":
			sendErr = s.notifier.SendFeishuByConfig(ctx, channel.Config, message)
		case "webhook":
			sendErr = s.notifier.SendWebhookByConfig(ctx, channel.Config, message)
		}

		if sendErr != nil {
			s.logger.Error("发送通知失败",
				zap.String("type", channel.Type),
				zap.Error(sendErr))
		} else {
			s.logger.Info("通知发送成功", zap.String("type", channel.Type))
		}
	}
}

// handleSystemReady 处理系统就绪消息
func (s *SerialService) handleSystemReady(jsonData string) {
	var msg map[string]interface{}
	if err := json.Unmarshal([]byte(jsonData), &msg); err != nil {
		s.logger.Error("系统消息解析失败", zap.Error(err))
		return
	}

	if message, ok := msg["message"].(string); ok {
		s.logger.Info("系统就绪", zap.String("message", message))
	}
}

// handleHeartbeat 处理心跳消息
func (s *SerialService) handleHeartbeat(msg map[string]interface{}) {
	timestamp, _ := msg["timestamp"].(float64)
	memoryUsage, _ := msg["memory_usage"].(float64)
	bufferSize, _ := msg["buffer_size"].(float64)

	s.logger.Debug("设备心跳",
		zap.Int64("timestamp", int64(timestamp)),
		zap.Float64("memory_usage", memoryUsage),
		zap.Int("buffer_size", int(bufferSize)))
}

// handleSMSSendResult 处理短信发送结果
func (s *SerialService) handleSMSSendResult(msg map[string]interface{}) {
	success, _ := msg["success"].(bool)
	to, _ := msg["to"].(string)
	requestID, _ := msg["request_id"].(string)
	timestamp, _ := msg["timestamp"].(float64)

	if requestID == "" {
		s.logger.Warn("收到短信发送结果但缺少 request_id", zap.Any("msg", msg))
		return
	}

	// 从数据库获取消息记录
	ctx := context.Background()
	textMsg, err := s.textMsgService.Get(ctx, requestID)
	if err != nil {
		s.logger.Error("获取短信记录失败",
			zap.String("request_id", requestID),
			zap.Error(err))
		return
	}

	// 更新状态
	if success {
		textMsg.Status = "sent"
		s.logger.Info("短信发送成功",
			zap.String("to", to),
			zap.String("request_id", requestID))
	} else {
		textMsg.Status = "failed"
		s.logger.Error("短信发送失败",
			zap.String("to", to),
			zap.String("request_id", requestID))
	}

	// 更新时间戳（如果有的话）
	if timestamp > 0 {
		textMsg.Timestamp = int64(timestamp)
	}

	// 保存更新
	if err := s.textMsgService.Save(ctx, textMsg); err != nil {
		s.logger.Error("更新短信状态失败",
			zap.String("request_id", requestID),
			zap.Error(err))
	}
}

// SendSMS 发送短信
func (s *SerialService) SendSMS(to, content string) error {
	// 先保存发送记录，状态为 "sending"
	ctx := context.Background()
	msgID := uuid.NewString()
	msg := &models.TextMessage{
		ID:        msgID,
		From:      "", // 发送方是本机
		To:        to,
		Content:   content,
		Type:      "outgoing",
		Status:    "sending", // 初始状态为发送中
		Timestamp: time.Now().Unix(),
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := s.textMsgService.Save(ctx, msg); err != nil {
		s.logger.Error("保存短信发送记录失败", zap.Error(err))
		return err
	}

	// 发送命令，使用消息 ID 作为 request_id
	cmd := map[string]any{
		"action":     "send_sms",
		"to":         to,
		"content":    content,
		"request_id": msgID,
	}

	if err := s.sendJSONCommand(cmd); err != nil {
		s.logger.Error("发送短信命令失败", zap.Error(err))
		// 更新状态为失败
		msg.Status = "failed"
		s.textMsgService.Save(ctx, msg)
		return err
	}

	s.logger.Info("发送短信命令成功", zap.String("to", to), zap.String("request_id", msgID))

	return nil
}

// GetStatus 获取设备状态（从缓存读取，包含 mobile 信息和串口连接状态）
func (s *SerialService) GetStatus() (*StatusData, error) {
	// 获取连接信息
	portName, connected := s.getConnectionInfo()

	// 从缓存读取
	if status, ok := s.deviceCache.Get(CacheKeyDeviceStatus); ok {
		// 更新串口连接信息
		status.PortName = portName
		status.Connected = connected
		return status, nil
	}

	// 缓存未命中，但仍然返回连接状态
	status := &StatusData{
		PortName:  portName,
		Connected: connected,
	}
	return status, nil
}

// ResetStack 重启协议栈
func (s *SerialService) ResetStack() error {
	cmd := map[string]string{"action": "reset_stack"}
	if err := s.sendJSONCommand(cmd); err != nil {
		return err
	}
	return nil
}

// sendJSONCommand 发送JSON命令到设备
func (s *SerialService) sendJSONCommand(cmd any) error {
	if s.port == nil {
		return fmt.Errorf("串口未连接")
	}

	jsonData, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("JSON编码失败: %w", err)
	}

	// 使用 Lua 脚本定义的协议格式：CMD_START:{json}:CMD_END
	message := fmt.Sprintf("CMD_START:%s:CMD_END\r\n", string(jsonData))
	_, err = s.port.Write([]byte(message))
	if err != nil {
		return fmt.Errorf("串口写入失败: %w", err)
	}
	s.logger.Sugar().Debugf("send command: %v", string(jsonData))

	return nil
}
