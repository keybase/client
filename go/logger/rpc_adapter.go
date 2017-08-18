// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// RPCLoggerAdapter is used to turn a logger complying to the rpc.LogOutput interface
// into one that can be used as a logger.Logger
type RPCLoggerAdapter struct {
	log rpc.LogOutput
}

func NewRPCLoggerAdapter(log rpc.LogOutput) Logger {
	return RPCLoggerAdapter{
		log: log,
	}
}

func (l RPCLoggerAdapter) Debug(format string, args ...interface{}) {
	l.log.Debug(format, args)
}

func (l RPCLoggerAdapter) CDebugf(_ context.Context, format string, args ...interface{}) {
	l.log.Debug(format, args)
}

func (l RPCLoggerAdapter) Info(format string, args ...interface{}) {
	l.log.Info(format, args)
}

func (l RPCLoggerAdapter) CInfof(_ context.Context, format string, args ...interface{}) {
	l.log.Info(format, args)
}

func (l RPCLoggerAdapter) Notice(format string, args ...interface{}) {
	l.log.Warning(format, args)
}

func (l RPCLoggerAdapter) CNoticef(_ context.Context, format string, args ...interface{}) {
	l.log.Warning(format, args)
}

func (l RPCLoggerAdapter) Warning(format string, args ...interface{}) {
	l.log.Warning(format, args)
}

func (l RPCLoggerAdapter) CWarningf(_ context.Context, format string, args ...interface{}) {
	l.log.Warning(format, args)
}

func (l RPCLoggerAdapter) Error(format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) Errorf(format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) CErrorf(_ context.Context, format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) Critical(format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) CCriticalf(_ context.Context, format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) Fatalf(format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) CFatalf(_ context.Context, format string, args ...interface{}) {
	l.log.Error(format, args)
}

func (l RPCLoggerAdapter) Profile(format string, args ...interface{}) {
	l.log.Profile(format, args)
}

func (l RPCLoggerAdapter) Configure(style string, debug bool, filename string) {

}

func (l RPCLoggerAdapter) RotateLogFile() error {
	return nil
}

func (l RPCLoggerAdapter) CloneWithAddedDepth(depth int) Logger {
	return l
}

func (l RPCLoggerAdapter) SetExternalHandler(handler ExternalHandler) {

}
