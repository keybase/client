package logger

type LogLevel int

const (
	NONE     LogLevel = 0
	DEBUG    LogLevel = 1
	INFO     LogLevel = 2
	NOTICE   LogLevel = 3
	WARN     LogLevel = 4
	ERROR    LogLevel = 5
	CRITICAL LogLevel = 6
	FATAL    LogLevel = 7
)
