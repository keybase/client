package libkbfs

import (
	"fmt"
	"testing"
)

// SafeTestReporter logs failures as they happen, but ferries failure
// calls back to the main test goroutine, to avoid violating
// testing.T's FailNow() semantics.
type SafeTestReporter struct {
	t *testing.T
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
	// panic here, since a Goexit() might leave the main thread
	// waiting for results.
	panic(fmt.Errorf(format, args...))
}

func (ctr *SafeTestReporter) CheckForFailures() {
	// Empty for now, since any fatal failure will have panic'd the
	// test.  In the future, we may have a better strategy.
}
