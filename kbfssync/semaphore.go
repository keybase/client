// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import (
	"fmt"
	"math"
	"sync"

	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// Semaphore implements a counting semaphore; it maintains a resource
// count, and exposes methods for acquiring those resources -- waiting
// if desired -- and releasing those resources back.
type Semaphore struct {
	lock      sync.RWMutex
	count     int64
	onRelease chan struct{}
}

// NewSemaphore returns a new Semaphore with a resource count of
// 0. Use Release() to set the initial resource count.
func NewSemaphore() *Semaphore {
	return &Semaphore{
		onRelease: make(chan struct{}),
	}
}

// Count returns the current resource count.
func (s *Semaphore) Count() int64 {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.count
}

// tryAcquire tries to acquire n resources. If successful, nil is
// returned. Otherwise, a channel which will be closed when new
// resources are available is returned. In either case, the
// possibly-updated resource count is returned.
func (s *Semaphore) tryAcquire(n int64) (<-chan struct{}, int64) {
	s.lock.Lock()
	defer s.lock.Unlock()
	if n <= s.count {
		s.count -= n
		return nil, s.count
	}

	return s.onRelease, s.count
}

// Acquire blocks until it is possible to atomically subtract n (which
// must be positive) from the resource count without causing it to go
// negative, and then returns the updated resource count and nil. If
// the given context is canceled or times out first, it instead does
// not change the resource count, and returns the resource count at
// the time it blocked (which is necessarily less than n), and a
// wrapped ctx.Err().
func (s *Semaphore) Acquire(ctx context.Context, n int64) (int64, error) {
	if n <= 0 {
		panic(fmt.Sprintf("n=%d must be positive", n))
	}

	for {
		onRelease, count := s.tryAcquire(n)
		if onRelease == nil {
			return count, nil
		}

		select {
		case <-onRelease:
			// Go to the top of the loop.
		case <-ctx.Done():
			return count, errors.WithStack(ctx.Err())
		}
	}
}

// ForceAcquire atomically subtracts n (which must be positive) from the
// resource count without waking up any waiting acquirers. It is meant for
// correcting the initial resource count of the semaphore. It's okay if adding
// n causes the resource count goes negative, but it must not cause the
// resource count to underflow. The updated resource count is returned.
func (s *Semaphore) ForceAcquire(n int64) int64 {
	if n <= 0 {
		panic(fmt.Sprintf("n=%d must be positive", n))
	}

	s.lock.Lock()
	defer s.lock.Unlock()
	if s.count < (math.MinInt64 + n) {
		panic(fmt.Sprintf("s.count=%d - n=%d would underflow",
			s.count, n))
	}
	s.count -= n
	return s.count
}

// TryAcquire atomically subtracts n (which must be positive) from the resource
// count without waking up any waiting acquirers, as long as it wouldn't go
// negative. If the count would go negative, it doesn't update the count but
// still returns the difference between the count and n. TryAcquire is
// successful if the return value is non-negative, and unsuccessful if the
// return value is negative. If the count would underflow, it panics.
// Otherwise, TryAcquire returns the updated resource count.
func (s *Semaphore) TryAcquire(n int64) int64 {
	if n <= 0 {
		panic(fmt.Sprintf("n=%d must be positive", n))
	}

	s.lock.Lock()
	defer s.lock.Unlock()
	if s.count < n {
		if s.count < (math.MinInt64 + n) {
			panic(fmt.Sprintf("s.count=%d - n=%d would overflow",
				s.count, n))
		}
		return s.count - n
	}
	s.count -= n
	return s.count
}

// Release atomically adds n (which must be positive) to the resource
// count. It must not cause the resource count to overflow. If there
// are waiting acquirers, it wakes up at least one of them to make
// progress, assuming that no new acquirers arrive in the meantime.
// The updated resource count is returned.
func (s *Semaphore) Release(n int64) int64 {
	if n <= 0 {
		panic(fmt.Sprintf("n=%d must be positive", n))
	}

	s.lock.Lock()
	defer s.lock.Unlock()
	if s.count > (math.MaxInt64 - n) {
		panic(fmt.Sprintf("s.count=%d + n=%d would overflow",
			s.count, n))
	}
	s.count += n
	// TODO: A better implementation would keep track of each
	// waiter and how much it wants to acquire and only wake up
	// waiters that could possibly succeed.
	close(s.onRelease)
	s.onRelease = make(chan struct{})
	return s.count
}
