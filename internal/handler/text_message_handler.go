package handler

import (
	"net/http"

	"github.com/dushixiang/uart_sms_forwarder/internal/repo"
	"github.com/dushixiang/uart_sms_forwarder/internal/service"

	"github.com/go-orz/orz"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

// TextMessageHandler 短信API处理器
type TextMessageHandler struct {
	logger  *zap.Logger
	service *service.TextMessageService
	repo    *repo.TextMessageRepo
}

// NewTextMessageHandler 创建短信Handler实例
func NewTextMessageHandler(logger *zap.Logger, service *service.TextMessageService, repo *repo.TextMessageRepo) *TextMessageHandler {
	return &TextMessageHandler{
		logger:  logger,
		service: service,
		repo:    repo,
	}
}

// List 查询短信列表
func (h *TextMessageHandler) List(c echo.Context) error {

	// 执行分页查询
	ctx := c.Request().Context()
	pr := orz.GetPageRequest(c, "timestamp")

	builder := orz.NewPageBuilder(h.repo).
		PageRequest(pr).
		Equal("type", c.QueryParam("type")).
		Equal("status", c.QueryParam("status")).
		Contains("from", c.QueryParam("from")).
		Contains("to", c.QueryParam("to")).
		Contains("content", c.QueryParam("content"))

	page, err := builder.Execute(ctx)
	if err != nil {
		return err
	}

	// 返回完整密钥,由前端控制显示/隐藏
	return orz.Ok(c, orz.Map{
		"items": page.Items,
		"total": page.Total,
	})
}

// Get 获取单条短信
// GET /api/messages/:id
func (h *TextMessageHandler) Get(c echo.Context) error {
	id := c.Param("id")
	msg, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		h.logger.Error("获取短信失败", zap.Error(err), zap.String("id", id))
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "短信不存在",
		})
	}

	return c.JSON(http.StatusOK, msg)
}

// Delete 删除单条短信
// DELETE /api/messages/:id
func (h *TextMessageHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
	}

	if err := h.service.Delete(c.Request().Context(), id); err != nil {
		h.logger.Error("删除短信失败", zap.Error(err), zap.String("id", id))
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "删除失败",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "删除成功",
	})
}

// Clear 清空所有短信
// DELETE /api/messages
func (h *TextMessageHandler) Clear(c echo.Context) error {
	if err := h.service.Clear(c.Request().Context()); err != nil {
		h.logger.Error("清空短信失败", zap.Error(err))
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "清空失败",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "清空成功",
	})
}

// GetStats 获取统计信息
// GET /api/messages/stats
func (h *TextMessageHandler) GetStats(c echo.Context) error {
	stats, err := h.service.GetStats(c.Request().Context())
	if err != nil {
		h.logger.Error("获取统计信息失败", zap.Error(err))
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "获取统计信息失败",
		})
	}

	return c.JSON(http.StatusOK, stats)
}
