package log

import (
	"context"
	"os"

	"github.com/segmentio/go-loggly"
	"github.com/sirupsen/logrus"
)

// DefaultLogger represents the default logger that is not bound to any specific
// context.
var DefaultLogger *Entry

const (
	PanicLevel = logrus.PanicLevel
	ErrorLevel = logrus.ErrorLevel
	WarnLevel  = logrus.WarnLevel
	InfoLevel  = logrus.InfoLevel
	DebugLevel = logrus.DebugLevel
)

// Entry repre
type Entry struct {
	logrus.Entry

	isTesting bool
}

// F wraps the logrus.Fields type for the convenience of typing less.
type F logrus.Fields

// LogglyHook sends logs to loggly
type LogglyHook struct {
	client       *loggly.Client
	host         string
	FilteredKeys map[string]bool
}

// New creates a new logger, starting at a WARN level and including the current
// processes pid as a field.
func New() *Entry {
	l := logrus.New()
	l.Level = logrus.WarnLevel
	l.Formatter.(*logrus.TextFormatter).FullTimestamp = true
	l.Formatter.(*logrus.TextFormatter).TimestampFormat = "2006-01-02T15:04:05.000Z07:00"
	return &Entry{Entry: *logrus.NewEntry(l).WithField("pid", os.Getpid())}
}

// Set establishes a new context to which the provided sub-logger is bound
func Set(parent context.Context, logger *Entry) context.Context {
	return context.WithValue(parent, &loggerContextKey, logger)
}

// Ctx returns the logger bound to the provided context, otherwise
// providing the default logger.
func Ctx(ctx context.Context) *Entry {
	if ctx == nil {
		return DefaultLogger
	}

	found := ctx.Value(&loggerContextKey)
	if found == nil {
		return DefaultLogger
	}

	return found.(*Entry)
}

// PushContext is a helper method to derive a new context with a modified logger
// bound to it, where the logger is derived from the current value on the
// context.
func PushContext(parent context.Context, modFn func(*Entry) *Entry) context.Context {
	current := Ctx(parent)
	next := modFn(current)
	return Set(parent, next)
}

func SetLevel(level logrus.Level) {
	DefaultLogger.SetLevel(level)
}

func WithField(key string, value interface{}) *Entry {
	result := DefaultLogger.WithField(key, value)
	return result
}

func WithFields(fields F) *Entry {
	return DefaultLogger.WithFields(fields)
}

func WithStack(stackProvider interface{}) *Entry {
	return DefaultLogger.WithStack(stackProvider)
}

// ===== Delegations =====

// Debugf logs a message at the debug severity.
func Debugf(format string, args ...interface{}) {
	DefaultLogger.Debugf(format, args...)
}

// Debug logs a message at the debug severity.
func Debug(args ...interface{}) {
	DefaultLogger.Debug(args...)
}

// Infof logs a message at the Info severity.
func Infof(format string, args ...interface{}) {
	DefaultLogger.Infof(format, args...)
}

// Info logs a message at the Info severity.
func Info(args ...interface{}) {
	DefaultLogger.Info(args...)
}

// Warnf logs a message at the Warn severity.
func Warnf(format string, args ...interface{}) {
	DefaultLogger.Warnf(format, args...)
}

// Warn logs a message at the Warn severity.
func Warn(args ...interface{}) {
	DefaultLogger.Warn(args...)
}

// Errorf logs a message at the Error severity.
func Errorf(format string, args ...interface{}) {
	DefaultLogger.Errorf(format, args...)
}

// Error logs a message at the Error severity.
func Error(args ...interface{}) {
	DefaultLogger.Error(args...)
}

// Panicf logs a message at the Panic severity.
func Panicf(format string, args ...interface{}) {
	DefaultLogger.Panicf(format, args...)
}

// Panic logs a message at the Panic severity.
func Panic(args ...interface{}) {
	DefaultLogger.Panic(args...)
}

// StartTest shifts the default logger into "test" mode.  See Entry's
// documentation for the StartTest() method for more info.
func StartTest(level logrus.Level) func() []*logrus.Entry {
	return DefaultLogger.StartTest(level)
}

type contextKey string

var loggerContextKey = contextKey("logger")

func init() {
	DefaultLogger = New()
}
