// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

// Loggerf is a minimal log interface (using proper formatter style methods)
type Loggerf interface {
	Debugf(s string, args ...any)
	Infof(s string, args ...any)
	Warningf(s string, args ...any)
	Errorf(s string, args ...any)
}

type loggerInternal interface {
	Debug(s string, args ...any)
	Info(s string, args ...any)
	Warning(s string, args ...any)
	Errorf(s string, args ...any)
}

type logf struct {
	log loggerInternal
}

// NewLoggerf adapts a logger
func NewLoggerf(log loggerInternal) Loggerf {
	return logf{log: log}
}

// Debugf forwards to Logger.Debug
func (l logf) Debugf(s string, args ...any) {
	l.log.Debug(s, args...)
}

// Infof forwards to Logger.Info
func (l logf) Infof(s string, args ...any) {
	l.log.Info(s, args...)
}

// Warningf forwards to Logger.Warning
func (l logf) Warningf(s string, args ...any) {
	l.log.Warning(s, args...)
}

// Errorf forwards to Logger.Errorf
func (l logf) Errorf(s string, args ...any) {
	l.log.Errorf(s, args...)
}
