package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dushixiang/uart_sms_forwarder/internal/models"
	"github.com/dushixiang/uart_sms_forwarder/internal/repo"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TextMessageService 短信服务
type TextMessageService struct {
	repo   *repo.TextMessageRepo
	logger *zap.Logger
}

// NewTextMessageService 创建短信服务实例
func NewTextMessageService(logger *zap.Logger, repo *repo.TextMessageRepo) *TextMessageService {
	return &TextMessageService{
		repo:   repo,
		logger: logger,
	}
}

// Stats 统计信息
type Stats struct {
	TotalCount    int64 `json:"totalCount"`
	IncomingCount int64 `json:"incomingCount"`
	OutgoingCount int64 `json:"outgoingCount"`
	TodayCount    int64 `json:"todayCount"`
}

// Save 保存短信记录
func (s *TextMessageService) Save(ctx context.Context, msg *models.TextMessage) error {
	if err := s.repo.Create(ctx, msg); err != nil {
		s.logger.Error("保存短信记录失败", zap.Error(err), zap.String("id", msg.ID))
		return fmt.Errorf("保存短信记录失败: %w", err)
	}
	return nil
}

// Get 获取单条短信记录
func (s *TextMessageService) Get(ctx context.Context, id string) (*models.TextMessage, error) {
	msg, err := s.repo.FindById(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("短信记录不存在")
		}
		s.logger.Error("获取短信记录失败", zap.Error(err), zap.String("id", id))
		return nil, fmt.Errorf("获取短信记录失败: %w", err)
	}
	return &msg, nil
}

// Delete 删除单条短信记录
func (s *TextMessageService) Delete(ctx context.Context, id string) error {
	if err := s.repo.DeleteById(ctx, id); err != nil {
		s.logger.Error("删除短信记录失败", zap.Error(err), zap.String("id", id))
		return fmt.Errorf("删除短信记录失败: %w", err)
	}
	s.logger.Info("删除短信记录成功", zap.String("id", id))
	return nil
}

// Clear 清空所有短信记录
func (s *TextMessageService) Clear(ctx context.Context) error {
	db := s.repo.GetDB(ctx)
	if err := db.Where("1 = 1").Delete(&models.TextMessage{}).Error; err != nil {
		s.logger.Error("清空短信记录失败", zap.Error(err))
		return fmt.Errorf("清空短信记录失败: %w", err)
	}
	s.logger.Info("清空短信记录成功")
	return nil
}

// GetStats 获取统计信息
func (s *TextMessageService) GetStats(ctx context.Context) (*Stats, error) {
	db := s.repo.GetDB(ctx)

	stats := &Stats{}

	// 总数
	if err := db.Model(&models.TextMessage{}).Count(&stats.TotalCount).Error; err != nil {
		return nil, fmt.Errorf("统计总数失败: %w", err)
	}

	// 接收数量
	if err := db.Model(&models.TextMessage{}).Where("type = ?", "incoming").Count(&stats.IncomingCount).Error; err != nil {
		return nil, fmt.Errorf("统计接收数量失败: %w", err)
	}

	// 发送数量
	if err := db.Model(&models.TextMessage{}).Where("type = ?", "outgoing").Count(&stats.OutgoingCount).Error; err != nil {
		return nil, fmt.Errorf("统计发送数量失败: %w", err)
	}

	// 今日数量（按 timestamp 字段）
	todayStart := time.Now().Truncate(24 * time.Hour).UnixMilli()
	if err := db.Model(&models.TextMessage{}).Where("timestamp >= ?", todayStart).Count(&stats.TodayCount).Error; err != nil {
		return nil, fmt.Errorf("统计今日数量失败: %w", err)
	}

	return stats, nil
}
