// +build windows

package logger

// These had a weird unicode character which made it look messy on Windows

const (
	fancyFormat   = "%{color}%{time:15:04:05.000000} - [%{level:.4s} %{module} %{shortfile}] %{id:03x}%{color:reset} %{message}"
	plainFormat   = "[%{level:.4s}] %{id:03x} %{message}"
	fileFormat    = "%{time:15:04:05.000000} - [%{level:.4s} %{module} %{shortfile}] %{id:03x} %{message}"
	defaultFormat = "%{color}- %{level} %{message}%{color:reset}"
)
