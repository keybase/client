package systests

import (
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
)

type testRunFunc func(t libkb.TestingTB)

type testAttempt struct {
	sync.Mutex
	t      *testing.T
	failed bool
}

func (t *testAttempt) Error(args ...any) {
	t.Log(args...)
}

func (t *testAttempt) Errorf(format string, args ...any) {
	t.Logf(format, args...)
}

func (t *testAttempt) Fail() {
	t.Lock()
	t.failed = true
	t.Unlock()
}

func (t *testAttempt) FailNow() {
	t.Lock()
	t.failed = true
	t.Unlock()
	panic("FailNow call")
}

func (t *testAttempt) Failed() bool {
	t.Lock()
	defer t.Unlock()
	return t.failed
}

func (t *testAttempt) Fatal(args ...any) {
	t.Log(args...)
	t.Lock()
	t.failed = true
	t.Unlock()
	panic("Fatal call")
}

func (t *testAttempt) Fatalf(format string, args ...any) {
	t.Logf(format, args...)
	t.Lock()
	t.failed = true
	t.Unlock()
	panic("Fatalf call")
}

func (t *testAttempt) Log(args ...any) {
	t.t.Log(args...)
}

func (t *testAttempt) Logf(format string, args ...any) {
	t.t.Logf(format, args...)
}

func (t *testAttempt) Name() string {
	return t.t.Name()
}

func (t *testAttempt) Skip(args ...any) {
	t.t.Skip(args...)
}

func (t *testAttempt) SkipNow() {
	t.t.SkipNow()
}

func (t *testAttempt) Skipf(format string, args ...any) {
	t.t.Skipf(format, args...)
}

func (t *testAttempt) Skipped() bool {
	return t.t.Skipped()
}

func (t *testAttempt) Helper() {
	t.t.Helper()
}

// retryFlakeyTestOnlyUseIfPermitted is not ideal, so please do no use it
// unless you ask max first. Right now, it's only being used for TestRekey,
// which has a flake in it but hopefully is going to be phased out, so not
// really worth fixing the flake.
func retryFlakeyTestOnlyUseIfPermitted(t *testing.T, numTries int, test testRunFunc) {
	for i := 0; i < numTries-1; i++ {
		attempt := testAttempt{t: t}
		if attempt.run(test) {
			return
		}
	}
	// The last time, run with the standard test failure system.
	test(t)
}

func (t *testAttempt) run(testRun testRunFunc) (ret bool) {
	ret = true
	defer func() {
		if r := recover(); r != nil {
			t.t.Logf("Recovered from fatal test failure: %s", r)
			ret = false
		}
	}()
	testRun(t)
	ret = !t.failed
	return ret
}
