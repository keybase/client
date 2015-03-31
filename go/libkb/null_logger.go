package libkb

type NullLogger struct{}

func NewNullLogger() *NullLogger {
	return &NullLogger{}
}

func (l *NullLogger) Debug(format string, args ...interface{})    {}
func (l *NullLogger) Info(format string, args ...interface{})     {}
func (l *NullLogger) Warning(format string, args ...interface{})  {}
func (l *NullLogger) Notice(format string, args ...interface{})   {}
func (l *NullLogger) Errorf(format string, args ...interface{})   {}
func (l *NullLogger) Critical(format string, args ...interface{}) {}
