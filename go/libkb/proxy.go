package libkb

// Represents the different types of supported proxies
type ProxyType int
const (
	No_Proxy ProxyType = iota
	Socks
	HTTP_Connect
)
// Maps a string to an enum. Used to list the different types of supported proxies and to convert
// config options into the enum
var ProxyTypeStrToEnum = map[string]ProxyType{"SOCKS": Socks, "HTTP_Connect": HTTP_Connect}