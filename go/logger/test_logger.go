// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"fmt"
	"os"
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
	Failed() bool
	Name() string
}

// TestLogger is a Logger that writes to a TestLogBackend.  All
// messages except Fatal are printed using Logf, to avoid failing a
// test that is trying to test an error condition.  No context tags
// are logged.
type TestLogger struct {
	log          TestLogBackend
	extraDepth   int
	failReported bool
	sync.Mutex
}

func NewTestLogger(log TestLogBackend) *TestLogger {
	return &TestLogger{log: log}
}

// Verify TestLogger fully implements the Logger interface.
var _ Logger = (*TestLogger)(nil)

// ctx can be `nil`
func (log *TestLogger) common(ctx context.Context, lvl logging.Level, useFatal bool, fmts string, arg ...interface{}) {
	if log.log.Failed() {
		log.Lock()
		if !log.failReported {
			log.log.Logf("TEST FAILED: %s", log.log.Name())
		}
		log.failReported = true
		log.Unlock()
	}

	if os.Getenv("KEYBASE_TEST_DUP_LOG_TO_STDOUT") != "" {
		fmt.Printf(prepareString(ctx,
			log.prefixCaller(log.extraDepth, lvl, fmts))+"\n", arg...)
	}

	if ctx != nil {
		if useFatal {
			log.log.Fatalf(prepareString(ctx,
				log.prefixCaller(log.extraDepth, lvl, fmts)), arg...)
		} else {
			log.log.Logf(prepareString(ctx,
				log.prefixCaller(log.extraDepth, lvl, fmts)), arg...)
		}
	} else {
		if useFatal {
			log.log.Fatalf(log.prefixCaller(log.extraDepth, lvl, fmts), arg...)
		} else {
			log.log.Logf(log.prefixCaller(log.extraDepth, lvl, fmts), arg...)
		}
	}
}

func (log *TestLogger) prefixCaller(extraDepth int, lvl logging.Level, fmts string) string {
	// The testing library doesn't let us control the stack depth,
	// and it always prints out its own prefix, so use \r to clear
	// it out (at least on a terminal) and do our own formatting.
	_, file, line, _ := runtime.Caller(3 + extraDepth)
	elements := strings.Split(file, "/")
	failed := ""
	if log.log.Failed() {
		failed = "[X] "
	}

	fileLine := fmt.Sprintf("%s:%d", elements[len(elements)-1], line)
	return fmt.Sprintf("\r%s %s%-23s: [%.1s] %s", time.Now().Format("2006-01-02 15:04:05.00000"),
		failed, fileLine, lvl, fmts)
}

func (log *TestLogger) Debug(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.DEBUG, false, fmts, arg...)
}

func (log *TestLogger) CDebugf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.DEBUG, false, fmts, arg...)
}

func (log *TestLogger) Info(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.INFO, false, fmts, arg...)
}

func (log *TestLogger) CInfof(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.INFO, false, fmts, arg...)
}

func (log *TestLogger) Notice(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.NOTICE, false, fmts, arg...)
}

func (log *TestLogger) CNoticef(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.NOTICE, false, fmts, arg...)
}

func (log *TestLogger) Warning(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.WARNING, false, fmts, arg...)
}

func (log *TestLogger) CWarningf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.WARNING, false, fmts, arg...)
}

func (log *TestLogger) Error(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.ERROR, false, fmts, arg...)
}

func (log *TestLogger) Errorf(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.ERROR, false, fmts, arg...)
}

func (log *TestLogger) CErrorf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.ERROR, false, fmts, arg...)
}

func (log *TestLogger) Critical(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.CRITICAL, false, fmts, arg...)
}

func (log *TestLogger) CCriticalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.CRITICAL, false, fmts, arg...)
}

func (log *TestLogger) Fatalf(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.CRITICAL, true, fmts, arg...)
}

func (log *TestLogger) CFatalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.common(ctx, logging.CRITICAL, true, fmts, arg...)
}

func (log *TestLogger) Profile(fmts string, arg ...interface{}) {
	log.common(context.TODO(), logging.CRITICAL, false, fmts, arg...)
}

func (log *TestLogger) Configure(style string, debug bool, filename string) {
	// no-op
}

func (log *TestLogger) CloneWithAddedDepth(depth int) Logger {
	log.Lock()
	defer log.Unlock()
	var clone TestLogger
	clone.log = log.log
	clone.extraDepth = log.extraDepth + depth
	clone.failReported = log.failReported
	return &clone
}

// no-op stubs to fulfill the Logger interface
func (log *TestLogger) SetExternalHandler(_ ExternalHandler) {}
