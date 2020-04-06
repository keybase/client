// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"bufio"
	"io"
	"sync"
	"time"

	"github.com/keybase/go-logging"
)

const loggingFrequency = 10 * time.Millisecond

type BufferedLoggerConfig struct {
	Frequency time.Duration
	Size      int
}

type triggerableTimer struct {
	C          chan struct{}
	timer      *time.Timer
	sentinelCh chan struct{}
	shutdownCh chan struct{}
}

func newTriggerableTimer(d time.Duration) *triggerableTimer {
	t := &triggerableTimer{
		C:          make(chan struct{}, 1),
		sentinelCh: make(chan struct{}, 1),
		timer:      time.NewTimer(0),
		shutdownCh: make(chan struct{}),
	}
	go func() {
		for {
			select {
			case <-t.timer.C:
				<-t.sentinelCh
				t.C <- struct{}{}
			case <-t.shutdownCh:
				t.timer.Stop()
				return
			}
		}
	}()
	return t
}

func (t *triggerableTimer) ResetIfStopped(d time.Duration) {
	if d == 0 {
		return
	}
	select {
	case t.sentinelCh <- struct{}{}:
		t.timer.Reset(d)
	default:
	}
}

func (t *triggerableTimer) Close() {
	close(t.shutdownCh)
}

type autoFlushingBufferedWriter struct {
	lock           sync.RWMutex
	bufferedWriter *bufio.Writer
	backupWriter   *bufio.Writer

	frequency    time.Duration
	timer        *triggerableTimer
	shutdown     chan struct{}
	doneShutdown chan struct{}
}

var _ io.Writer = &autoFlushingBufferedWriter{}

func (writer *autoFlushingBufferedWriter) backgroundFlush() {
	for {
		select {
		case <-writer.timer.C:
			// Swap out active and backup writers
			writer.lock.Lock()
			writer.bufferedWriter, writer.backupWriter = writer.
				backupWriter, writer.bufferedWriter
			writer.lock.Unlock()

			writer.backupWriter.Flush()
		case <-writer.shutdown:
			writer.timer.shutdownCh <- struct{}{}
			writer.bufferedWriter.Flush()
			// If anyone is listening, notify them that we are done shutting down.
			select {
			case writer.doneShutdown <- struct{}{}:
			default:
			}
			return
		}
	}
}

func defaultBufferedLoggerConfig() *BufferedLoggerConfig {
	return &BufferedLoggerConfig{
		Frequency: loggingFrequency,
		Size:      4096,
	}
}

// NewAutoFlushingBufferedWriter returns an io.Writer that buffers its output
// and flushes automatically after `flushFrequency`.
func NewAutoFlushingBufferedWriter(baseWriter io.Writer,
	config *BufferedLoggerConfig) (w io.Writer, shutdown chan struct{}, done chan struct{}) {
	if config == nil {
		config = defaultBufferedLoggerConfig()
	}
	result := &autoFlushingBufferedWriter{
		bufferedWriter: bufio.NewWriterSize(baseWriter, config.Size),
		backupWriter:   bufio.NewWriterSize(baseWriter, config.Size),
		frequency:      config.Frequency,
		timer:          newTriggerableTimer(config.Frequency),
		shutdown:       make(chan struct{}),
		doneShutdown:   make(chan struct{}),
	}
	go result.backgroundFlush()
	return result, result.shutdown, result.doneShutdown
}

func (writer *autoFlushingBufferedWriter) Write(p []byte) (int, error) {
	// The locked resource here, the pointer bufferedWriter, is only being read
	// even though this function is Write.
	writer.lock.RLock()
	defer writer.lock.RUnlock()

	n, err := writer.bufferedWriter.Write(p)
	if err != nil {
		return n, err
	}
	writer.timer.ResetIfStopped(writer.frequency)

	return n, nil
}

// EnableBufferedLogging turns on buffered logging - this is a performance
// boost at the expense of not getting all the logs in a crash.
func EnableBufferedLogging() {
	writer, shutdown, done := NewAutoFlushingBufferedWriter(ErrorWriter(), nil)
	stdErrLoggingShutdown = shutdown
	stdErrLoggingShutdownDone = done
	logBackend := logging.NewLogBackend(writer, "", 0)
	logging.SetBackend(logBackend)
}

// Shutdown shuts down logger, flushing remaining logs if a backend with
// buffering is used.
func Shutdown() {
	select {
	case stdErrLoggingShutdown <- struct{}{}:
		// Wait till logger is done
		<-stdErrLoggingShutdownDone
	default:
	}
}
