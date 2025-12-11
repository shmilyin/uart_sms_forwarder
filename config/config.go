package config

type AppConfig struct {
	JWT    JWTConfig         `json:"JWT"`
	Users  map[string]string `json:"Users"`  // 用户名 -> bcrypt加密的密码
	Serial SerialConfig      `json:"Serial"` // 串口配置
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret       string `json:"Secret"`
	ExpiresHours int    `json:"ExpiresHours"`
}

// SerialConfig 串口配置
type SerialConfig struct {
	Port string `json:"Port"` // 串口路径，为空则自动检测
}
