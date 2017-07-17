// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"os"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type logQueue struct {
	name     string
	level    keybase1.LogLevel
	ui       *LogUI
	handleID int
	buffer   chan *logEntry
	drop     chan bool
}

func newLogQueue(name string, level keybase1.LogLevel, ui *LogUI) *logQueue {
	q := &logQueue{
		name:   name,
		level:  level,
		ui:     ui,
		buffer: make(chan *logEntry, 10000),
		drop:   make(chan bool, 1),
	}

	go q.processQueue()

	return q
}

func (q *logQueue) String() string {
	return fmt.Sprintf("%s: level %d, handle id %d", q.name, q.level, q.handleID)
}

func (q *logQueue) SetHandleID(id int) {
	q.handleID = id
}

func (q *logQueue) HandleID() int {
	return q.handleID
}

func (q *logQueue) Log(e *logEntry) {
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
	close(q.buffer)
	q.buffer = nil
}

func (q *logQueue) processQueue() {
	for e := range q.buffer {
		if e.level < q.level {
			continue
		}
		q.ui.Log(e.level, e.format, e.args)
	}
}

// setDropFlag puts a flag into the drop channel if the channel is
// empty.  This is to signal that external log messages have been
// dropped.
func (q *logQueue) setDropFlag() {
	select {
	case q.drop <- true:
		// do this outside the logging mechanism to make sure it gets through
		fmt.Fprintf(os.Stderr, "WARNING: dropping log messages destined for %q due to full log buffer\n", q.name)
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
