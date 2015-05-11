package libkbfs

import (
	"runtime"
	"sync"
	"testing"
)

// SafeTestReporter logs failures as they happen, but ferries failure
// calls back to the main test goroutine, to avoid violating
// testing.T's FailNow() semantics.
type SafeTestReporter struct {
	t     *testing.T
	fatal bool
	lock  sync.Mutex
}

func NewSafeTestReporter(t *testing.T) *SafeTestReporter {
	return &SafeTestReporter{t: t}
}

func (ctr *SafeTestReporter) Errorf(format string, args ...interface{}) {
	ctr.t.Errorf(format, args...)
}

// Fatalf somewhat changes the testing.T.Fatalf semantics by first
// calling Fail(), then runtime.Goexit(), and then later (in the main
// thread) calling FailNow().  This helps prevent deadlocks when
// something other than the main goroutine could be invoking Fatalf().
func (ctr *SafeTestReporter) Fatalf(format string, args ...interface{}) {
	ctr.Errorf(format, args...)
	ctr.lock.Lock()
	defer ctr.lock.Unlock()
	ctr.fatal = true
	runtime.Goexit()
}

func (ctr *SafeTestReporter) CheckForFailures() {
	ctr.lock.Lock()
	defer ctr.lock.Unlock()
	if ctr.fatal {
		// some fatal failure happened, mark the test as immediately failed.
		ctr.t.FailNow()
	}
}
