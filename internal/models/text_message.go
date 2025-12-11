package models

// TextMessage 短信记录
type TextMessage struct {
	ID        string `gorm:"primaryKey" json:"id"`     // UUID
	From      string `gorm:"index" json:"from"`        // 发送方号码
	To        string `gorm:"index" json:"to"`          // 接收方号码
	Content   string `gorm:"type:text" json:"content"` // 短信内容
	Type      string `gorm:"index" json:"type"`        // 消息类型：incoming（收到）、outgoing（发送）
	Status    string `gorm:"index" json:"status"`      // 状态：received、sent、failed
	Timestamp int64  `gorm:"index" json:"timestamp"`   // 时间戳（毫秒）
	CreatedAt int64  `json:"createdAt"`                // 创建时间
	UpdatedAt int64  `json:"updatedAt" gorm:"autoUpdateTime:milli"`
}

// TableName 指定表名
func (TextMessage) TableName() string {
	return "text_messages"
}
