// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"golang.org/x/net/context"
)

type FLogger interface {
	CriticalfLogger
	DebugfLogger
	ErrorfLogger
	FatalfLogger
	InfofLogger
	NoticefLogger
	WarningfLogger
}

type ContextFLogger interface {
	CCriticalfLogger
	CDebugfLogger
	CErrorfLogger
	CFatalfLogger
	CInfofLogger
	CNoticefLogger
	CWarningfLogger
}

type CriticalfLogger interface {
	Criticalf(s string, v ...interface{})
}

type DebugfLogger interface {
	Debugf(s string, v ...interface{})
}

type ErrorfLogger interface {
	Errorf(s string, v ...interface{})
}

type FatalfLogger interface {
	Fatalf(s string, v ...interface{})
}

type InfofLogger interface {
	Infof(s string, v ...interface{})
}

type NoticefLogger interface {
	Noticef(s string, v ...interface{})
}

type WarningfLogger interface {
	Warningf(s string, v ...interface{})
}

type CCriticalfLogger interface {
	CCriticalf(ctx context.Context, s string, v ...interface{})
}

type CDebugfLogger interface {
	CDebugf(ctx context.Context, s string, v ...interface{})
}

type CErrorfLogger interface {
	CErrorf(ctx context.Context, s string, v ...interface{})
}

type CFatalfLogger interface {
	CFatalf(ctx context.Context, s string, v ...interface{})
}

type CInfofLogger interface {
	CInfof(ctx context.Context, s string, v ...interface{})
}

type CNoticefLogger interface {
	CNoticef(ctx context.Context, s string, v ...interface{})
}

type CWarningfLogger interface {
	CWarningf(ctx context.Context, s string, v ...interface{})
}

type LogHandler interface {
	Log(level LogLevel, format string, args []interface{})
}

type Forwarder interface {
	SetExternalHandler(handler LogHandler)
}

type Shutdownable interface {
	Shutdown()
}

type Configurable interface {
	Configure(style string, debug bool, filename string)
}

type LogFileRotater interface {
	RotateLogFile() error
}
