// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package clocktest

import (
	"sync"
	"time"
)

// TestClock returns a set time as the current time.
type TestClock struct {
	l sync.RWMutex
	t time.Time
}

// NewTestClockNow constructs a new test clock, using the current
// wall-clock time as the static time.
func NewTestClockNow() *TestClock {
	return &TestClock{t: time.Now()}
}

// NewTestClockAndTimeNow constructs a new test clock, using the
// current wall-clock time as the static time, and returns that time
// as a convenience.
func NewTestClockAndTimeNow() (*TestClock, time.Time) {
	t0 := time.Now()
	return &TestClock{t: t0}, t0
}

// Now implements the Clock interface for TestClock.
func (tc *TestClock) Now() time.Time {
	tc.l.RLock()
	defer tc.l.RUnlock()
	return tc.t
}

// Set sets the test clock time.
func (tc *TestClock) Set(t time.Time) {
	tc.l.Lock()
	defer tc.l.Unlock()
	tc.t = t
}

// Add adds to the test clock time.
func (tc *TestClock) Add(d time.Duration) {
	tc.l.Lock()
	defer tc.l.Unlock()
	tc.t = tc.t.Add(d)
}
