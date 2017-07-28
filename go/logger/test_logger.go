// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"

	logging "github.com/keybase/go-logging"

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
// test that is trying to test an error condition.
type TestLogger struct {
	log          TestLogBackend
	extraDepth   int
	startTime    time.Time
	firstLogOnce *sync.Once
}

// NewTestLogger returns a logger to be used for a specific test. The
// given startTime is used for calculating durations from the start of
// the test, which is printed out for each log. Only one *TestLogger
// should be used per test.
func NewTestLogger(log TestLogBackend, startTime time.Time) *TestLogger {
	return &TestLogger{
		log:          log,
		startTime:    startTime,
		firstLogOnce: &sync.Once{},
	}
}

// Verify TestLogger fully implements the Logger interface.
var _ Logger = (*TestLogger)(nil)

func (log *TestLogger) prefixCaller(
	extraDepth int, lvl logging.Level, fmts string) string {
	var firstLog bool
	log.firstLogOnce.Do(func() {
		firstLog = true
	})

	// The testing library doesn't let us control the stack depth,
	// and it always prints out its own prefix, so use \r to clear
	// it out (at least on a terminal) and do our own formatting.
	_, file, line, _ := runtime.Caller(2 + extraDepth)
	elements := strings.Split(file, "/")
	dt := time.Since(log.startTime)
	dtStr := dt.String()
	if firstLog {
		dtStr += " (started at " + log.startTime.String() + ")"
	}
	return fmt.Sprintf("\r%s:%d: %s [%.1s] %s",
		elements[len(elements)-1], line, dtStr, lvl, fmts)
}

func (log *TestLogger) Debug(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.DEBUG, fmts), arg...)
}

func (log *TestLogger) CDebugf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.DEBUG, fmts)), arg...)
}

func (log *TestLogger) Info(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.INFO, fmts), arg...)
}

func (log *TestLogger) CInfof(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.INFO, fmts)), arg...)
}

func (log *TestLogger) Notice(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.NOTICE, fmts), arg...)
}

func (log *TestLogger) CNoticef(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.NOTICE, fmts)), arg...)
}

func (log *TestLogger) Warning(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.WARNING, fmts), arg...)
}

func (log *TestLogger) CWarningf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.WARNING, fmts)), arg...)
}

func (log *TestLogger) Error(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.ERROR, fmts), arg...)
}

func (log *TestLogger) Errorf(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.ERROR, fmts), arg...)
}

func (log *TestLogger) CErrorf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.ERROR, fmts)), arg...)
}

func (log *TestLogger) Critical(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.CRITICAL, fmts), arg...)
}

func (log *TestLogger) CCriticalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Logf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.CRITICAL, fmts)), arg...)
}

func (log *TestLogger) Fatalf(fmts string, arg ...interface{}) {
	log.log.Fatalf(log.prefixCaller(log.extraDepth, logging.CRITICAL, fmts), arg...)
}

func (log *TestLogger) CFatalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log.Fatalf(prepareString(ctx,
		log.prefixCaller(log.extraDepth, logging.CRITICAL, fmts)), arg...)
}

func (log *TestLogger) Profile(fmts string, arg ...interface{}) {
	log.log.Logf(log.prefixCaller(log.extraDepth, logging.CRITICAL, fmts), arg...)
}

func (log *TestLogger) Configure(style string, debug bool, filename string) {
	// no-op
}

func (log *TestLogger) RotateLogFile() error {
	// no-op
	return nil
}

func (log *TestLogger) CloneWithAddedDepth(depth int) Logger {
	clone := *log
	clone.extraDepth += depth
	return &clone
}

// no-op stubs to fulfill the Logger interface
func (log *TestLogger) SetExternalHandler(_ ExternalHandler) {}
