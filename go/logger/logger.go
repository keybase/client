// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"context"
	"log"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ExternalHandler interface {
	Log(level keybase1.LogLevel, format string, args []any)
}

type BaseLogger interface {
	Debug(format string, args ...any)
	Info(format string, args ...any)
	Warning(format string, args ...any)
	Error(format string, args ...any)
}

type ContextInterface interface {
	BaseLogger
	Ctx() context.Context
	UpdateContextToLoggerContext(context.Context) ContextInterface
}

type Logger interface {
	BaseLogger
	// CDebugf logs a message at debug level, with a context and
	// formatting args.
	CDebugf(ctx context.Context, format string, args ...any)
	// CInfo logs a message at info level, with a context and formatting args.
	CInfof(ctx context.Context, format string, args ...any)
	// Notice logs a message at notice level, with formatting args.
	Notice(format string, args ...any)
	// CNoticef logs a message at notice level, with a context and
	// formatting args.
	CNoticef(ctx context.Context, format string, args ...any)
	// Warning logs a message at warning level, with formatting args.
	CWarningf(ctx context.Context, format string, args ...any)
	// Error logs a message at error level, with formatting args
	Errorf(format string, args ...any)
	// CErrorf logs a message at error level, with a context and
	// formatting args.
	CErrorf(ctx context.Context, format string, args ...any)
	// Critical logs a message at critical level, with formatting args.
	Critical(format string, args ...any)
	// CCriticalf logs a message at critical level, with a context and
	// formatting args.
	CCriticalf(ctx context.Context, format string, args ...any)
	// Fatalf logs a message at fatal level, with formatting args.
	Fatalf(format string, args ...any)
	// Fatalf logs a message at fatal level, with a context and formatting args.
	CFatalf(ctx context.Context, format string, args ...any)
	// Profile logs a profile message, with formatting args.
	Profile(fmts string, arg ...any)

	// Returns a logger that is like the current one, except with
	// more logging depth added on.
	CloneWithAddedDepth(depth int) Logger
	// Configure sets the style, debug level, and filename of the
	// logger.  Output isn't redirected to the file until
	// the log file rotation is configured.
	Configure(style string, debug bool, filename string)

	// SetExternalHandler sets a handler that will be called with every log message.
	SetExternalHandler(handler ExternalHandler)
}

type InternalLogger struct {
	log *log.Logger
}

func NewInternalLogger(log *log.Logger) *InternalLogger {
	return &InternalLogger{
		log: log,
	}
}

func (l *InternalLogger) Debug(fmt string, arg ...any) {
	l.log.Printf(fmt, arg...)
}

func (l *InternalLogger) CDebugf(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Info(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_INFO.String()+fmt, arg...)
}

func (l *InternalLogger) CInfof(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(keybase1.LogLevel_INFO.String()+prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Notice(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_NOTICE.String()+fmt, arg...)
}

func (l *InternalLogger) CNoticef(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(keybase1.LogLevel_NOTICE.String()+prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Warning(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_WARN.String()+fmt, arg...)
}

func (l *InternalLogger) CWarningf(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(keybase1.LogLevel_WARN.String()+prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Error(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_ERROR.String()+fmt, arg...)
}

func (l *InternalLogger) Errorf(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_ERROR.String()+fmt, arg...)
}

func (l *InternalLogger) CErrorf(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(keybase1.LogLevel_ERROR.String()+prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Critical(fmt string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_CRITICAL.String()+fmt, arg...)
}

func (l *InternalLogger) CCriticalf(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Printf(keybase1.LogLevel_CRITICAL.String()+prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Fatalf(fmt string, arg ...any) {
	l.log.Fatalf(fmt, arg...)
}

func (l *InternalLogger) CFatalf(ctx context.Context, fmt string,
	arg ...any,
) {
	l.log.Fatalf(prepareString(ctx, fmt), arg...)
}

func (l *InternalLogger) Profile(fmts string, arg ...any) {
	l.log.Printf(keybase1.LogLevel_DEBUG.String()+fmts, arg...)
}
func (l *InternalLogger) Configure(_ string, _ bool, _ string) {}
func (l *InternalLogger) SetExternalHandler(_ ExternalHandler) {}
func (l *InternalLogger) CloneWithAddedDepth(_ int) Logger {
	return l
}
