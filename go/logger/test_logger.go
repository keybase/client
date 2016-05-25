// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"fmt"
	"runtime"
	"strings"

	logging "github.com/keybase/go-logging"

	"golang.org/x/net/context"
)

// TestLogBackend is an interface for logging to a test object (i.e.,
// a *testing.T).  We define this in order to avoid pulling in the
// "testing" package in exported code.
type TestLogBackend interface {
	Logf(format string, args ...interface{})
	FailNow()
}

// TestLogger is a Logger that writes to a TestLogBackend.  All
// messages except Fatal are printed using Logf, to avoid failing a
// test that is trying to test an error condition.  No context tags
// are logged.
type TestLogger struct {
	backend    TestLogBackend
	extraDepth int
	fields     Fields
}

func NewTestLogger(log TestLogBackend) *TestLogger {
	return &TestLogger{backend: log}
}

// Verify TestLogger fully implements the Logger interface.
var _ Logger = (*TestLogger)(nil)

func (log *TestLogger) log(lvl logging.Level, format string, args ...interface{}) {
	// The testing library doesn't let us control the stack depth,
	// and it always prints out its own prefix, so use \r to clear
	// it out (at least on a terminal) and do our own formatting.
	_, file, line, _ := runtime.Caller(2 + log.extraDepth)
	elements := strings.Split(file, "/")
	var fieldsStr string
	if len(log.fields) > 0 {
		fieldsStr = fmt.Sprintf(" %v", log.fields)
	}
	log.backend.Logf("\r%s:%d: [%.1s]%s "+format,
		append([]interface{}{elements[len(elements)-1], line, lvl, fieldsStr}, args...)...)
}

func (log *TestLogger) Debug(fmts string, arg ...interface{}) {
	log.log(logging.DEBUG, fmts, arg...)
}

func (log *TestLogger) CDebugf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.DEBUG, fmts, arg...)
}

func (log *TestLogger) Info(fmts string, arg ...interface{}) {
	log.log(logging.INFO, fmts, arg...)
}

func (log *TestLogger) CInfof(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.INFO, fmts, arg...)
}

func (log *TestLogger) Notice(fmts string, arg ...interface{}) {
	log.log(logging.NOTICE, fmts, arg...)
}

func (log *TestLogger) CNoticef(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.NOTICE, fmts, arg...)
}

func (log *TestLogger) Warning(fmts string, arg ...interface{}) {
	log.log(logging.WARNING, fmts, arg...)
}

func (log *TestLogger) CWarningf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.WARNING, fmts, arg...)
}

func (log *TestLogger) Error(fmts string, arg ...interface{}) {
	log.log(logging.ERROR, fmts, arg...)
}

func (log *TestLogger) Errorf(fmts string, arg ...interface{}) {
	log.log(logging.ERROR, fmts, arg...)
}

func (log *TestLogger) CErrorf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.ERROR, fmts, arg...)
}

func (log *TestLogger) Critical(fmts string, arg ...interface{}) {
	log.log(logging.CRITICAL, fmts, arg...)
}

func (log *TestLogger) CCriticalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.CRITICAL, fmts, arg...)
}

func (log *TestLogger) Fatalf(fmts string, arg ...interface{}) {
	log.log(logging.CRITICAL, fmts, arg...)
	log.backend.FailNow()
}

func (log *TestLogger) CFatalf(ctx context.Context, fmts string,
	arg ...interface{}) {
	log.log(logging.CRITICAL, fmts, arg...)
	log.backend.FailNow()
}

func (log *TestLogger) Profile(fmts string, arg ...interface{}) {
	log.log(logging.CRITICAL, fmts, arg...)
}

func (log *TestLogger) Configure(style string, debug bool, filename string) {
	// no-op
}

func (log *TestLogger) RotateLogFile() error {
	// no-op
	return nil
}

func (log *TestLogger) clone() *TestLogger {
	clone := *log
	clone.fields = make(Fields, len(log.fields))
	for k, v := range log.fields {
		clone.fields[k] = v
	}
	return &clone
}

func (log *TestLogger) CloneWithAddedDepth(depth int) Logger {
	clone := log.clone()
	clone.extraDepth += depth
	return clone
}

func (log *TestLogger) CloneWithAddedFields(fields Fields) Logger {
	clone := log.clone()
	for k, v := range fields {
		clone.fields[k] = v
	}
	return clone
}

// no-op stubs to fulfill the Logger interface
func (log *TestLogger) SetExternalHandler(_ ExternalHandler) {}
