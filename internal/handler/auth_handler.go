package handler

import (
	"net/http"

	"github.com/dushixiang/uart_sms_forwarder/config"
	"github.com/dushixiang/uart_sms_forwarder/internal/util"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	logger *zap.Logger
	config *config.AppConfig
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(logger *zap.Logger, config *config.AppConfig) *AuthHandler {
	return &AuthHandler{
		logger: logger,
		config: config,
	}
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token     string `json:"token"`
	Username  string `json:"username"`
	ExpiresAt int64  `json:"expiresAt"`
}

// Login 处理登录请求
func (h *AuthHandler) Login(c echo.Context) error {
	// 获取请求参数
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Warn("登录请求参数解析失败", zap.Error(err))
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "请求参数错误",
		})
	}

	// 验证必填字段
	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "用户名和密码不能为空",
		})
	}

	// 从配置中获取用户密码哈希
	passwordHash, exists := h.config.Users[req.Username]
	if !exists {
		h.logger.Warn("用户不存在", zap.String("username", req.Username))
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "用户名或密码错误",
		})
	}

	// 验证密码
	err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if err != nil {
		h.logger.Warn("密码验证失败",
			zap.String("username", req.Username),
			zap.Error(err),
		)
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "用户名或密码错误",
		})
	}

	// 生成 JWT token
	token, expiresAt, err := util.GenerateToken(
		req.Username,
		h.config.JWT.Secret,
		h.config.JWT.ExpiresHours,
	)
	if err != nil {
		h.logger.Error("生成 token 失败",
			zap.String("username", req.Username),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "登录失败，请稍后重试",
		})
	}

	h.logger.Info("用户登录成功", zap.String("username", req.Username))

	// 返回 token 和用户信息
	return c.JSON(http.StatusOK, LoginResponse{
		Token:     token,
		Username:  req.Username,
		ExpiresAt: expiresAt,
	})
}
