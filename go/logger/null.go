// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import "golang.org/x/net/context"

type Null struct{}

func NewNull() *Null {
	return &Null{}
}

// Verify Null fully implements the Logger interface.
var _ Logger = (*Null)(nil)

func (l *Null) Debug(_ string, _ ...interface{})                         {}
func (l *Null) Info(_ string, _ ...interface{})                          {}
func (l *Null) Warning(_ string, _ ...interface{})                       {}
func (l *Null) Notice(_ string, _ ...interface{})                        {}
func (l *Null) Errorf(_ string, _ ...interface{})                        {}
func (l *Null) Critical(_ string, _ ...interface{})                      {}
func (l *Null) CCriticalf(_ context.Context, _ string, _ ...interface{}) {}
func (l *Null) Fatalf(_ string, _ ...interface{})                        {}
func (l *Null) CFatalf(_ context.Context, _ string, _ ...interface{})    {}
func (l *Null) Profile(_ string, _ ...interface{})                       {}
func (l *Null) CDebugf(_ context.Context, _ string, _ ...interface{})    {}
func (l *Null) CInfof(_ context.Context, _ string, _ ...interface{})     {}
func (l *Null) CNoticef(_ context.Context, _ string, _ ...interface{})   {}
func (l *Null) CWarningf(_ context.Context, _ string, _ ...interface{})  {}
func (l *Null) CErrorf(_ context.Context, _ string, _ ...interface{})    {}
func (l *Null) Error(_ string, _ ...interface{})                         {}
func (l *Null) Configure(_ string, _ bool, _ string)                     {}

func (l *Null) CloneWithAddedDepth(_ int) Logger { return l }

func (l *Null) SetExternalHandler(_ ExternalHandler) {}
func (l *Null) Shutdown()                            {}
