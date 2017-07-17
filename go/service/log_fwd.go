// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import keybase1 "github.com/keybase/client/go/protocol/keybase1"

type logEntry struct {
	level  keybase1.LogLevel
	format string
	args   []interface{}
}

type extLogger interface {
	Log(e *logEntry)
	SetHandleID(id int)
	HandleID() int
	Shutdown()
}

type logFwd struct {
	addCh    chan extLogger
	removeCh chan extLogger
	logCh    chan *logEntry
	doneCh   chan bool

	loggers map[int]extLogger
	idSeq   int
}

func newLogFwd() *logFwd {
	f := &logFwd{
		addCh:    make(chan extLogger),
		removeCh: make(chan extLogger),
		logCh:    make(chan *logEntry, 10000),
		doneCh:   make(chan bool),
		loggers:  make(map[int]extLogger),
	}

	go f.process()

	return f
}

func (f *logFwd) Add(x extLogger) {
	f.addCh <- x
}

func (f *logFwd) Remove(x extLogger) {
	f.removeCh <- x
}

func (f *logFwd) Log(level keybase1.LogLevel, format string, args []interface{}) {
	f.logCh <- &logEntry{level: level, format: format, args: args}
}

func (f *logFwd) Shutdown() {
	f.doneCh <- true
}

func (f *logFwd) process() {
	for {
		select {
		case x := <-f.addCh:
			f.loggers[f.idSeq] = x
			x.SetHandleID(f.idSeq)
			f.idSeq++
		case x := <-f.removeCh:
			delete(f.loggers, x.HandleID())
			x.Shutdown()
		case e := <-f.logCh:
			for _, x := range f.loggers {
				x.Log(e)
			}
		case <-f.doneCh:
			for _, x := range f.loggers {
				x.Shutdown()
			}
			return
		}
	}
}
