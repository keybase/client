// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// LogOutputWithDepthAdder is a wrapper around Logger to conform to
// rpc.LogOutput.
type LogOutputWithDepthAdder struct {
	Logger
}

var _ rpc.LogOutput = LogOutputWithDepthAdder{}

// CloneWithAddedDepth implements the rpc.LogOutput interface.
func (l LogOutputWithDepthAdder) CloneWithAddedDepth(
	depth int) rpc.LogOutputWithDepthAdder {
	return LogOutputWithDepthAdder{l.Logger.CloneWithAddedDepth(depth)}
}

// logOutputWithInfoToDebugShifter is a wrapper around l that shifts all
// Info logging to Debug. This is used in client/service to prevent
// rpc/connection.go logs from leaking to CLI.
type logOutputWithInfoToDebugShifter struct {
	l Logger
}

// NewLogOutputWithInfoToDebugShifter creates a wrapper around original Logger
// that shifts all Info logging to Debug. This is used in client/service to
// prevent rpc/connection.go logs from leaking to CLI.
func NewLogOutputWithInfoToDebugShifter(original Logger) Logger {
	return logOutputWithInfoToDebugShifter{
		l: original.CloneWithAddedDepth(1),
	}
}

var _ Logger = logOutputWithInfoToDebugShifter{}

// Debug passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Debug(format string, args ...interface{}) {
	l.l.Debug(format, args)
}

// Debug passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CDebugf(ctx context.Context, format string, args ...interface{}) {
	l.l.CDebugf(ctx, format, args)
}

// Info logs Debug to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Info(format string, args ...interface{}) {
	l.l.Debug(format, args)
}

// CInfof logs CDebugf to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CInfof(ctx context.Context, format string, args ...interface{}) {
	l.l.CDebugf(ctx, format, args)
}

// Notice passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Notice(format string, args ...interface{}) {
	l.l.Notice(format, args)
}

// CNoticef passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CNoticef(ctx context.Context, format string, args ...interface{}) {
	l.l.CNoticef(ctx, format, args)
}

// Warning passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Warning(format string, args ...interface{}) {
	l.l.Warning(format, args)
}

// CWarningf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CWarningf(ctx context.Context, format string, args ...interface{}) {
	l.l.CWarningf(ctx, format, args)
}

// Error passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Error(format string, args ...interface{}) {
	l.l.Error(format, args)
}

// Errorf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Errorf(format string, args ...interface{}) {
	l.l.Errorf(format, args)
}

// CErrorf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CErrorf(ctx context.Context, format string, args ...interface{}) {
	l.l.CErrorf(ctx, format, args)
}

// Critical passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Critical(format string, args ...interface{}) {
	l.l.Critical(format, args)
}

// CCriticalf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CCriticalf(ctx context.Context, format string, args ...interface{}) {
	l.l.CCriticalf(ctx, format, args)
}

// Fatalf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Fatalf(format string, args ...interface{}) {
	l.l.Fatalf(format, args)
}

// CFatalf passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) CFatalf(ctx context.Context, format string, args ...interface{}) {
	l.l.CFatalf(ctx, format, args)
}

// Profile passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Profile(fmts string, args ...interface{}) {
	l.l.Profile(fmts, args)
}

// Configure passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) Configure(style string, debug bool, filename string) {
	l.l.Configure(style, debug, filename)
}

// RotateLogFile passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) RotateLogFile() error {
	return l.l.RotateLogFile()
}

// CloneWithAddedDepth overrides the underlying method. This is needed so
// cloned loggers have guards as well.
func (l logOutputWithInfoToDebugShifter) CloneWithAddedDepth(depth int) Logger {
	return logOutputWithInfoToDebugShifter{l.l.CloneWithAddedDepth(depth)}
}

// SetExternalHandler passes the call to the underlying logger.
func (l logOutputWithInfoToDebugShifter) SetExternalHandler(handler ExternalHandler) {
	l.l.SetExternalHandler(handler)
}

// MakeLogOutputWithShiftAndDepthAdder makes a logger.LogOutputWithDepthAdder
// to pass into the rpc package. Note that this also shifts all Info logging to
// Debug, to avoid leaking CLI. This should only be used where shifting is
// desired. Otherwise, wrap a logger with LogOutputWithDepthAdder.
func MakeLogOutputWithShiftAndDepthAdder(l Logger) LogOutputWithDepthAdder {
	return LogOutputWithDepthAdder{
		Logger: NewLogOutputWithInfoToDebugShifter(l),
	}
}
