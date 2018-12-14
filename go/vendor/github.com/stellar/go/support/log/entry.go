package log

import (
	"context"
	"fmt"
	"io/ioutil"

	gerr "github.com/go-errors/errors"
	"github.com/sirupsen/logrus"
	"github.com/sirupsen/logrus/hooks/test"
	"github.com/stellar/go/support/errors"
)

// Ctx appends all fields from `e` to the new logger created from `ctx`
// logger and returns it.
func (e *Entry) Ctx(ctx context.Context) *Entry {
	if ctx == nil {
		return e
	}

	found := ctx.Value(&loggerContextKey)
	if found == nil {
		return e
	}

	entry := found.(*Entry)

	// Copy all fields from e to entry
	for key, value := range e.Data {
		entry = entry.WithField(key, value)
	}

	return entry
}

func (e *Entry) SetLevel(level logrus.Level) {
	e.Logger.Level = level
}

// WithField creates a child logger annotated with the provided key value pair.
// A subsequent call to one of the logging methods (Debug(), Error(), etc.) to
// the return value from this function will cause the emitted log line to
// include the provided value.
func (e *Entry) WithField(key string, value interface{}) *Entry {
	return &Entry{
		Entry: *e.Entry.WithField(key, value),
	}
}

// WithFields creates a child logger annotated with the provided key value
// pairs.
func (e *Entry) WithFields(fields F) *Entry {
	return &Entry{
		Entry: *e.Entry.WithFields(logrus.Fields(fields)),
	}
}

// WithStack annotates this error with a stack trace from `stackProvider`, if
// available.  normally `stackProvider` would be an error that implements
// `errors.StackTracer`.
func (e *Entry) WithStack(stackProvider interface{}) *Entry {
	stack := "unknown"

	if sp1, ok := stackProvider.(errors.StackTracer); ok {
		stack = fmt.Sprint(sp1.StackTrace())
	} else if sp2, ok := stackProvider.(*gerr.Error); ok {
		stack = fmt.Sprint(sp2.ErrorStack())
	}

	return e.WithField("stack", stack)
}

// Debugf logs a message at the debug severity.
func (e *Entry) Debugf(format string, args ...interface{}) {
	e.Entry.Debugf(format, args...)
}

// Debug logs a message at the debug severity.
func (e *Entry) Debug(args ...interface{}) {
	e.Entry.Debug(args...)
}

// Infof logs a message at the Info severity.
func (e *Entry) Infof(format string, args ...interface{}) {
	e.Entry.Infof(format, args...)
}

// Info logs a message at the Info severity.
func (e *Entry) Info(args ...interface{}) {
	e.Entry.Info(args...)
}

// Warnf logs a message at the Warn severity.
func (e *Entry) Warnf(format string, args ...interface{}) {
	e.Entry.Warnf(format, args...)
}

// Warn logs a message at the Warn severity.
func (e *Entry) Warn(args ...interface{}) {
	e.Entry.Warn(args...)
}

// Errorf logs a message at the Error severity.
func (e *Entry) Errorf(format string, args ...interface{}) {
	e.Entry.Errorf(format, args...)
}

// Error logs a message at the Error severity.
func (e *Entry) Error(args ...interface{}) {
	e.Entry.Error(args...)
}

// Panicf logs a message at the Panic severity.
func (e *Entry) Panicf(format string, args ...interface{}) {
	e.Entry.Panicf(format, args...)
}

// Panic logs a message at the Panic severity.
func (e *Entry) Panic(args ...interface{}) {
	e.Entry.Panic(args...)
}

// StartTest shifts this logger into "test" mode, ensuring that log lines will
// be recorded (rather than outputted).  The returned function concludes the
// test, switches the logger back into normal mode and returns a slice of all
// raw logrus entries that were created during the test.
func (e *Entry) StartTest(level logrus.Level) func() []*logrus.Entry {
	if e.isTesting {
		panic("cannot start logger test: already testing")
	}

	e.isTesting = true

	hook := &test.Hook{}
	e.Logger.Hooks.Add(hook)

	old := e.Logger.Out
	e.Logger.Out = ioutil.Discard

	oldLevel := e.Logger.Level
	e.Logger.Level = level

	return func() []*logrus.Entry {
		e.Logger.Level = oldLevel
		e.Logger.Out = old
		e.removeHook(hook)
		e.isTesting = false
		return hook.Entries
	}
}

// removeHook removes a hook, in the most complicated way possible.
func (e *Entry) removeHook(target logrus.Hook) {
	for lvl, hooks := range e.Logger.Hooks {
		kept := []logrus.Hook{}

		for _, hook := range hooks {
			if hook != target {
				kept = append(kept, hook)
			}
		}

		e.Logger.Hooks[lvl] = kept
	}
}
