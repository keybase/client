// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

type legacyAdapter struct {
	log legacy
}

// NewLoggerFromLegacyLogger adapts a legacy logger
func NewLoggerFromLegacyLogger(log legacy) Loggerf {
	return legacyAdapter{log: log}
}

// Debugf forwards to Logger.Debug
func (l legacyAdapter) Debugf(s string, args ...interface{}) {
	l.log.Debug(s, args...)
}

// Infof forwards to Logger.Info
func (l legacyAdapter) Infof(s string, args ...interface{}) {
	l.log.Info(s, args...)
}

// Warningf forwards to Logger.Warning
func (l legacyAdapter) Warningf(s string, args ...interface{}) {
	l.log.Warning(s, args...)
}

// Noticef forwards to Logger.Notice
func (l legacyAdapter) Noticef(s string, args ...interface{}) {
	l.log.Notice(s, args...)
}

// Errorf forwards to Logger.Errorf
func (l legacyAdapter) Errorf(s string, args ...interface{}) {
	l.log.Errorf(s, args...)
}

// Criticalf forwards to Logger.Critical
func (l legacyAdapter) Criticalf(s string, args ...interface{}) {
	l.log.Critical(s, args...)
}

// Fatalf forwards to Logger.Fatalf
func (l legacyAdapter) Fatalf(s string, args ...interface{}) {
	l.log.Fatalf(s, args...)
}

type simpleLogger interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type simpleAdapter struct {
	log simpleLogger
}

func NewLoggerFromSimpleLogger(log simpleLogger) Loggerf {
	return simpleAdapter{log: log}
}

func (l simpleAdapter) Debugf(s string, args ...interface{}) {
	l.log.Debug(s, args...)
}

func (l simpleAdapter) Infof(s string, args ...interface{}) {
	l.log.Info(s, args...)
}

func (l simpleAdapter) Noticef(s string, args ...interface{}) {
	l.log.Info(s, args...)
}

func (l simpleAdapter) Warningf(s string, args ...interface{}) {
	l.log.Warning(s, args...)
}

func (l simpleAdapter) Errorf(s string, args ...interface{}) {
	l.log.Errorf(s, args...)
}

func (l simpleAdapter) Criticalf(s string, args ...interface{}) {
	l.log.Errorf(s, args...)
}

func (l simpleAdapter) Fatalf(s string, args ...interface{}) {
	l.log.Errorf(s, args...)
}
