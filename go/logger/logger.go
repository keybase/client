// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type ExternalHandler interface {
	Log(level keybase1.LogLevel, format string, args []interface{})
}

type Logger interface {
	// Debug logs a message at debug level, with formatting args.
	Debug(format string, args ...interface{})
	// CDebugf logs a message at debug level, with a context and
	// formatting args.
	CDebugf(ctx context.Context, format string, args ...interface{})
	// Info logs a message at info level, with formatting args.
	Info(format string, args ...interface{})
	// CInfo logs a message at info level, with a context and formatting args.
	CInfof(ctx context.Context, format string, args ...interface{})
	// Notice logs a message at notice level, with formatting args.
	Notice(format string, args ...interface{})
	// CNoticef logs a message at notice level, with a context and
	// formatting args.
	CNoticef(ctx context.Context, format string, args ...interface{})
	// Warning logs a message at warning level, with formatting args.
	Warning(format string, args ...interface{})
	// CWarning logs a message at warning level, with a context and
	// formatting args.
	CWarningf(ctx context.Context, format string, args ...interface{})
	// Error logs a message at error level, with formatting args
	Error(format string, args ...interface{})
	// Errorf logs a message at error level, with formatting args.
	Errorf(format string, args ...interface{})
	// CErrorf logs a message at error level, with a context and
	// formatting args.
	CErrorf(ctx context.Context, format string, args ...interface{})
	// Critical logs a message at critical level, with formatting args.
	Critical(format string, args ...interface{})
	// CCriticalf logs a message at critical level, with a context and
	// formatting args.
	CCriticalf(ctx context.Context, format string, args ...interface{})
	// Fatalf logs a message at fatal level, with formatting args.
	Fatalf(format string, args ...interface{})
	// Fatalf logs a message at fatal level, with a context and formatting args.
	CFatalf(ctx context.Context, format string, args ...interface{})
	// Profile logs a profile message, with formatting args.
	Profile(fmts string, arg ...interface{})
	// Configure sets the style, debug level, and filename of the
	// logger.  Output isn't redirected to the file until
	// RotateLogFile is called for the first time.
	Configure(style string, debug bool, filename string)
	// RotateLogFile rotates the log file, if the underlying logger is
	// writing to a file.
	RotateLogFile() error

	// Returns a logger that is like the current one, except with
	// more logging depth added on.
	CloneWithAddedDepth(depth int) Logger

	// SetExternalHandler sets a handler that will be called with every log message.
	SetExternalHandler(handler ExternalHandler)
}
