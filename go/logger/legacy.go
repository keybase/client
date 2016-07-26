// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"io"
	"os"
	"testing"

	"github.com/keybase/client/go/logger/internal"
)

type legacy interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Notice(s string, args ...interface{})
	Error(s string, args ...interface{})
	Errorf(s string, args ...interface{})
	Critical(s string, args ...interface{})
	Fatalf(s string, args ...interface{})
	Profile(s string, args ...interface{})
}

func NewLegacyLogger(module string) LegacyLogger {
	return internal.New(module)
}

type LegacyLogger interface {
	legacy
	ContextLogger
}

// Configure only works on our internal logger
func Configure(log LegacyLogger, style string, debug bool, filename string) {
	stdLog := log.(*internal.Standard)
	stdLog.Configure(style, debug, filename)
}

// RotateLogFile only works on our internal logger
func RotateLogFile(log LegacyLogger) error {
	stdLog := log.(*internal.Standard)
	return stdLog.RotateLogFile()
}

// GetUnforwardedLogger only works on our internal logger
func GetUnforwardedLogger(log LegacyLogger) LegacyLogger {
	if log == nil {
		return nil
	}
	stdLog, ok := log.(*internal.Standard)
	if !ok {
		stdLog.Notice("Can't make Unforwarded logger from a non-standard logger")
		return nil
	}
	return stdLog
}

// SetExternalHandler only works on our internal logger
func SetExternalHandler(log LegacyLogger, handler internal.ExternalHandler) {
	stdLog := log.(*internal.Standard)
	stdLog.SetExternalHandler(handler)
}

func NewTestLogger(tb testing.TB) LegacyLogger {
	return internal.NewTestLogger(tb)
}

func OutputWriter() io.Writer {
	return os.Stdout
}

func ErrorWriter() io.Writer {
	return os.Stderr
}
