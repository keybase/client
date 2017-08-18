// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

// Loggerf is a minimal log interface (using proper formatter style methods)
type Loggerf interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type loggerInternal interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type logf struct {
	log loggerInternal
}

// NewLoggerf adapts a logger
func NewLoggerf(log loggerInternal) Loggerf {
	return logf{log: log}
}

// Debugf forwards to Logger.Debug
func (l logf) Debugf(s string, args ...interface{}) {
	l.log.Debug(s, args...)
}

// Infof forwards to Logger.Info
func (l logf) Infof(s string, args ...interface{}) {
	l.log.Info(s, args...)
}

// Warningf forwards to Logger.Warning
func (l logf) Warningf(s string, args ...interface{}) {
	l.log.Warning(s, args...)
}

// Errorf forwards to Logger.Errorf
func (l logf) Errorf(s string, args ...interface{}) {
	l.log.Errorf(s, args...)
}
