package test

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/logger"
)

// MemoryLog accumulates log messages in memory that can be printed
// out later.
type MemoryLog struct {
	m      sync.Mutex
	output string
}

var _ logger.TestLogBackend = (*MemoryLog)(nil)

// Logging stuff:

func (ml *MemoryLog) addOutput(s string) {
	ml.m.Lock()
	defer ml.m.Unlock()
	ml.output += s + "\n"
}

// Error implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Error(args ...interface{}) {
	ml.addOutput(fmt.Sprint(args...))
}

// Errorf implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Errorf(format string, args ...interface{}) {
	ml.addOutput(fmt.Sprintf(format, args...))
}

// Fatal implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Fatal(args ...interface{}) {
	ml.addOutput(fmt.Sprint(args...))
}

// Fatalf implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Fatalf(format string, args ...interface{}) {
	ml.addOutput(fmt.Sprintf(format, args...))
}

// Log implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Log(args ...interface{}) {
	ml.addOutput(fmt.Sprint(args...))
}

// Logf implements the logger.TestLogBackend interface for MemoryLog.
func (ml *MemoryLog) Logf(format string, args ...interface{}) {
	ml.addOutput(fmt.Sprintf(format, args...))
}

// PrintLog dumps the entire log so far to stdout.
func (ml *MemoryLog) PrintLog() {
	ml.m.Lock()
	defer ml.m.Unlock()
	fmt.Print(ml.output)
}
