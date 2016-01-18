// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
)

type logQueue struct {
	active      bool
	name        string
	level       keybase1.LogLevel
	ui          *LogUI
	handleID    int
	buffer      chan *logEntry
	drop        chan bool
	processDone chan bool
}

func newLogQueue() *logQueue {
	// empty until Setup is called
	return &logQueue{}
}

func (q *logQueue) Setup(name string, level keybase1.LogLevel, ui *LogUI) error {
	if q.active {
		return fmt.Errorf("Setup called on active queue, name = %s, level = %d", name, level)
	}
	q.name = name
	q.level = level
	q.ui = ui
	q.buffer = make(chan *logEntry, 10000)
	q.drop = make(chan bool, 1)
	q.processDone = make(chan bool, 1)

	q.active = true
	go q.processBuffer()

	return nil
}

func (q *logQueue) SetHandleID(id int) {
	q.handleID = id
}

func (q *logQueue) HandleID() int {
	return q.handleID
}

func (q *logQueue) Log(e *logEntry) {
	if !q.active {
		return
	}
	if e.level < q.level {
		return
	}
	select {
	case q.buffer <- e:
		q.checkDropFlag()
	default:
		q.setDropFlag()
	}
}

func (q *logQueue) Shutdown() {
	if q.buffer == nil {
		return
	}
	close(q.buffer)

	// wait a little bit to flush the buffer
	select {
	case <-q.processDone:
	case <-time.After(1 * time.Second):
	}

	q.buffer = nil
}

func (q *logQueue) processBuffer() {
	for e := range q.buffer {
		if e.level < q.level {
			continue
		}
		q.ui.Log(e.level, e.format, e.args)
	}
	q.processDone <- true

	q.active = false
}

// setDropFlag puts a flag into the drop channel if the channel is
// empty.  This is to signal that external log messages have been
// dropped.
func (q *logQueue) setDropFlag() {
	select {
	case q.drop <- true:
		// do this outside the logging mechanism to make sure it gets through
		fmt.Printf("WARNING: dropping log messages destined for %q due to full log buffer\n", q.name)
	default:
	}
}

// checkDropFlag checks to see if anything is in the drop channel.
// If there is a flag in there, it will warn client that log
// messages were dropped.
func (q *logQueue) checkDropFlag() {
	select {
	case <-q.drop:
		q.buffer <- &logEntry{
			level:  keybase1.LogLevel_WARN,
			format: "Service log messages were dropped due to full buffer",
		}
	default:
	}
}
