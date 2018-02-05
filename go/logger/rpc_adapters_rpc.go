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

// LogOutputWithDebugAndInfoGuards is a wrapper around Logger that disables
// Info and Debug logging.
type LogOutputWithDebugAndInfoGuards struct {
	Logger
}

var _ Logger = (*LogOutputWithDebugAndInfoGuards)(nil)

// Debug overrides the underlying method into a no-op.
func (l LogOutputWithDebugAndInfoGuards) Debug(string, ...interface{}) {}

// CDebugf overrides the underlying method into a no-op.
func (l LogOutputWithDebugAndInfoGuards) CDebugf(context.Context, string, ...interface{}) {}

// Info overrides the underlying method into a no-op.
func (l LogOutputWithDebugAndInfoGuards) Info(string, ...interface{}) {}

// CInfof overrides the underlying method into a no-op.
func (l LogOutputWithDebugAndInfoGuards) CInfof(context.Context, string, ...interface{}) {}

// CloneWithAddedDepth overrides the underlying method. This is needed so
// cloned loggers have guards as well.
func (l LogOutputWithDebugAndInfoGuards) CloneWithAddedDepth(depth int) Logger {
	return LogOutputWithDebugAndInfoGuards{l.Logger.CloneWithAddedDepth(depth)}
}
