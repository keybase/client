package libkbfs

import (
	"fmt"
	"runtime"
	"strings"
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

// makePrefix() returns a string with the file and line of the call site.
//
// This function was adapted from decorate() in testing/testing.go.
func makePrefix() string {
	// makePrefix + error + Errorf or Fatalf + function.
	_, file, line, ok := runtime.Caller(4)
	if ok {
		// Truncate file name at last file name separator.
		if index := strings.LastIndex(file, "/"); index >= 0 {
			file = file[index+1:]
		} else if index = strings.LastIndex(file, "\\"); index >= 0 {
			file = file[index+1:]
		}
	} else {
		file = "???"
		line = 1
	}
	return fmt.Sprintf("%s:%d", file, line)
}

func (ctr *SafeTestReporter) error(s string) {
	// Errorf() prepends the line number of the line below, but
	// there's nothing we can do about that.
	ctr.t.Errorf("%s: %s", makePrefix(), s)
}

func (ctr *SafeTestReporter) Errorf(format string, args ...interface{}) {
	ctr.error(fmt.Sprintf(format, args...))
}

// Fatalf somewhat changes the testing.T.Fatalf semantics by first
// calling Fail(), then runtime.Goexit(), and then later (in the main
// thread) calling FailNow().  This helps prevent deadlocks when
// something other than the main goroutine could be invoking Fatalf().
func (ctr *SafeTestReporter) Fatalf(format string, args ...interface{}) {
	s := fmt.Sprintf(format, args...)
	ctr.error(s)
	// panic here, since a Goexit() might leave the main thread
	// waiting for results.
	panic(s)
}

func (ctr *SafeTestReporter) CheckForFailures() {
	// Empty for now, since any fatal failure will have panic'd the
	// test.  In the future, we may have a better strategy.
}
