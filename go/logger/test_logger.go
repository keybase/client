package logger

import (
	"fmt"
	"runtime"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// TestLogBackend is an interface for logging to a test object (i.e.,
// a *testing.T).  We define this in order to avoid pulling in the
// "testing" package in exported code.
type TestLogBackend interface {
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
	Fatal(args ...interface{})
	Fatalf(format string, args ...interface{})
	Log(args ...interface{})
	Logf(format string, args ...interface{})
}

// TestLogger is a Logger that writes to a TestLogBackend.  All
// messages except Fatal are printed using Logf, to avoid failing a
// test that is trying to test an error condition.  No context tags
// are logged.
type TestLogger struct {
	log TestLogBackend
}

func NewTestLogger(log TestLogBackend) *TestLogger {
	return &TestLogger{log: log}
}

// Verify TestLogger fully implements the Logger interface.
var _ Logger = (*TestLogger)(nil)

func prefixCaller(fmts string) string {
	// The testing library doesn't let us control the stack depth, so
	// just print the file and line number ourselves.
	_, file, line, _ := runtime.Caller(2)
	elements := strings.Split(file, "/")
	return fmt.Sprintf("%s:%d %s", elements[len(elements)-1], line, fmts)
}

func (log *TestLogger) Debug(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CDebugf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Info(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CInfof(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Notice(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CNoticef(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Warning(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CWarningf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Error(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Errorf(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CErrorf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Critical(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CCriticalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Fatalf(fmts string, arg ...interface{}) {
	log.log.Fatalf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) CFatalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Fatalf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Profile(fmts string, arg ...interface{}) {
	log.log.Logf(prefixCaller(fmts), arg...)
}

func (log *TestLogger) Configure(style string, debug bool, filename string) {
	// no-op
}

func (log *TestLogger) RotateLogFile() error {
	// no-op
	return nil
}

// no-op stubs to fulfill the Logger interface
func (log *TestLogger) AddExternalLogger(externalLogger ExternalLogger) uint64 { return 0 }
func (log *TestLogger) RemoveExternalLogger(handle uint64)                     {}
func (log *TestLogger) SetExternalLogLevel(level keybase1.LogLevel)            {}
