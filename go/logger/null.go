// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import "golang.org/x/net/context"

type Null struct{}

func NewNull() *Null {
	return &Null{}
}

// Verify Null fully implements the Logger interface.
var _ Logger = (*Null)(nil)

func (l *Null) Debug(format string, args ...interface{})                       {}
func (l *Null) Info(format string, args ...interface{})                        {}
func (l *Null) Warning(format string, args ...interface{})                     {}
func (l *Null) Notice(format string, args ...interface{})                      {}
func (l *Null) Errorf(format string, args ...interface{})                      {}
func (l *Null) Critical(format string, args ...interface{})                    {}
func (l *Null) CCriticalf(ctx context.Context, fmt string, arg ...interface{}) {}
func (l *Null) Fatalf(fmt string, arg ...interface{})                          {}
func (l *Null) CFatalf(ctx context.Context, fmt string, arg ...interface{})    {}
func (l *Null) Profile(fmts string, arg ...interface{})                        {}
func (l *Null) CDebugf(ctx context.Context, fmt string, arg ...interface{})    {}
func (l *Null) CInfof(ctx context.Context, fmt string, arg ...interface{})     {}
func (l *Null) CNoticef(ctx context.Context, fmt string, arg ...interface{})   {}
func (l *Null) CWarningf(ctx context.Context, fmt string, arg ...interface{})  {}
func (l *Null) CErrorf(ctx context.Context, fmt string, arg ...interface{})    {}
func (l *Null) Error(fmt string, arg ...interface{})                           {}
func (l *Null) Configure(style string, debug bool, filename string)            {}
func (l *Null) RotateLogFile() error                                           { return nil }

func (l *Null) CloneWithAddedDepth(depth int) Logger { return l }

func (l *Null) SetExternalHandler(handler ExternalHandler) {}
func (l *Null) Shutdown()                                  {}
