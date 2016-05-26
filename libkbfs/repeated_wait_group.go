// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"golang.org/x/net/context"
)

// RepeatedWaitGroup can be used in place of a sync.WaitGroup when
// code may need to repeatedly wait for a set of tasks to finish.
// (sync.WaitGroup requires special mutex usage to make this work
// properly, which can easily lead to deadlocks.)  We use a mutex,
// int, and channel to track and synchronize on the number of
// outstanding tasks.
type RepeatedWaitGroup struct {
	lock     sync.Mutex
	num      int
	isIdleCh chan struct{} // leave as nil when initializing
}

// Add indicates that a number of tasks have begun.
func (rwg *RepeatedWaitGroup) Add(delta int) {
	rwg.lock.Lock()
	defer rwg.lock.Unlock()
	if rwg.isIdleCh == nil {
		rwg.isIdleCh = make(chan struct{})
	}
	if rwg.num+delta < 0 {
		panic("RepeatedWaitGroup count would be negative")
	}
	rwg.num += delta
	if rwg.num == 0 {
		close(rwg.isIdleCh)
		rwg.isIdleCh = nil
	}
}

// Wait blocks until either the underlying task count goes to 0, or
// the gien context is canceled.
func (rwg *RepeatedWaitGroup) Wait(ctx context.Context) error {
	isIdleCh := func() chan struct{} {
		rwg.lock.Lock()
		defer rwg.lock.Unlock()
		return rwg.isIdleCh
	}()

	if isIdleCh == nil {
		return nil
	}

	select {
	case <-isIdleCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Done indicates that one task has completed.
func (rwg *RepeatedWaitGroup) Done() {
	rwg.Add(-1)
}
