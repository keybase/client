// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycletest

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/clockwork"
)

// FakeClock is a clockwork fake clock that also reports each After call, so a
// test can advance time only once the code under test is waiting on it.
type FakeClock struct {
	clockwork.FakeClock
	mu      sync.Mutex
	pending map[time.Duration]int
	changed chan struct{}
}

func NewFakeClock() *FakeClock {
	return &FakeClock{
		FakeClock: clockwork.NewFakeClock(),
		pending:   make(map[time.Duration]int),
		changed:   make(chan struct{}),
	}
}

func (c *FakeClock) After(d time.Duration) <-chan time.Time {
	ch := c.FakeClock.After(d)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pending[d]++
	close(c.changed)
	c.changed = make(chan struct{})
	return ch
}

// ForgetAfters drops unconsumed After calls, such as those of a goroutine
// that has exited.
func (c *FakeClock) ForgetAfters() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pending = make(map[time.Duration]int)
}

// WaitForAfter consumes one After(d) call, waiting for it if needed. It
// returns false if done closes first.
func (c *FakeClock) WaitForAfter(t testing.TB, d time.Duration, done <-chan struct{}) bool {
	t.Helper()
	timeout := time.After(5 * time.Second)
	for {
		c.mu.Lock()
		if c.pending[d] > 0 {
			c.pending[d]--
			c.mu.Unlock()
			return true
		}
		changed := c.changed
		c.mu.Unlock()
		select {
		case <-changed:
		case <-done:
			return false
		case <-timeout:
			t.Fatalf("nothing waited on After(%v)", d)
			return false
		}
	}
}
