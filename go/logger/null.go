package logger

type Null struct{}

func NewNull() *Null {
	return &Null{}
}

func (l *Null) Debug(format string, args ...interface{})    {}
func (l *Null) Info(format string, args ...interface{})     {}
func (l *Null) Warning(format string, args ...interface{})  {}
func (l *Null) Notice(format string, args ...interface{})   {}
func (l *Null) Errorf(format string, args ...interface{})   {}
func (l *Null) Critical(format string, args ...interface{}) {}
