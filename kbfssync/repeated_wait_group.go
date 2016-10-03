// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

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
	// TODO: we could remove this paused bool by converting the
	// `pauseCh` into an `onPauseCh` that starts off initialized and
	// gets set to nil when a pause happens.  But that would require
	// an initializer for the channel.
	paused  bool
	pauseCh chan struct{} // leave as nil when initializing
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
// the given context is canceled.
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

// WaitUnlessPaused works like Wait, except it can return early if the
// wait group is paused.  It returns whether it was paused with
// outstanding work still left in the group.
func (rwg *RepeatedWaitGroup) WaitUnlessPaused(ctx context.Context) (
	bool, error) {
	paused, isIdleCh, pauseCh := func() (bool, chan struct{}, chan struct{}) {
		rwg.lock.Lock()
		defer rwg.lock.Unlock()
		if !rwg.paused && rwg.pauseCh == nil {
			rwg.pauseCh = make(chan struct{})
		}
		return rwg.paused, rwg.isIdleCh, rwg.pauseCh
	}()

	if isIdleCh == nil {
		return false, nil
	}

	if paused {
		return true, nil
	}

	select {
	case <-isIdleCh:
		return false, nil
	case <-pauseCh:
		return true, nil
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

// Pause causes any current or future callers of `WaitUnlessPaused` to
// return immediately.
func (rwg *RepeatedWaitGroup) Pause() {
	rwg.lock.Lock()
	defer rwg.lock.Unlock()
	rwg.paused = true
	if rwg.pauseCh != nil {
		close(rwg.pauseCh)
		rwg.pauseCh = nil
	}
}

// Resume unpauses the wait group, allowing future callers of
// `WaitUnlessPaused` to wait until all the outstanding work is
// completed.
func (rwg *RepeatedWaitGroup) Resume() {
	rwg.lock.Lock()
	defer rwg.lock.Unlock()
	if rwg.pauseCh != nil {
		panic("Non-nil pauseCh on resume!")
	}
	rwg.paused = false
}

// Done indicates that one task has completed.
func (rwg *RepeatedWaitGroup) Done() {
	rwg.Add(-1)
}
