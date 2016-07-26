// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"golang.org/x/net/context"
)

// Logger is a deprecated logger interface we want to migrate away from.
// Use Loggerf
type Logger interface {
	legacy
}

// Loggerf is a simple logger interface that only defines formatter style methods.
// Do not add to this interface!
type Loggerf interface {
	Debugf(s string, v ...interface{})
	Infof(s string, v ...interface{})
	Noticef(s string, v ...interface{})
	Warningf(s string, v ...interface{})
	Errorf(s string, v ...interface{})
	Fatalf(s string, v ...interface{})
	Criticalf(s string, v ...interface{})
}

// ContextLogger is a logger with context
type ContextLogger interface {
	CDebugf(ctx context.Context, s string, v ...interface{})
	CInfof(ctx context.Context, s string, v ...interface{})
	CNoticef(ctx context.Context, s string, v ...interface{})
	CWarningf(ctx context.Context, s string, v ...interface{})
	CErrorf(ctx context.Context, s string, v ...interface{})
	CFatalf(ctx context.Context, s string, v ...interface{})
	CCriticalf(ctx context.Context, s string, v ...interface{})
}
