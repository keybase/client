// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package rpc

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"sync"
	"time"
)

// fireOnce is a construct to synchronize different goroutines. Specifically,
// one routine can use wait() to wait on a signal, and another routine can call
// fire() to wake up the first routine. Only the first call to fire() is
// effective, and multiple calls to fire() don't panic.
//
// A zero value fireOnce is valid, and no-op for both fire() and wait(). Use
// newFireOnce() to make one that's fire-able.
//
// This is to replace the use case where a channel may be used to synchronize
// different goroutines, and one routine waits on a channel read while another
// closes the channel to signal the first routine. fireOnce addresses the issue
// where second call to close the channel can panic.
type fireOnce struct {
	ch   chan struct{}
	once *sync.Once
}

func newFireOnce() fireOnce {
	return fireOnce{
		ch:   make(chan struct{}),
		once: &sync.Once{},
	}
}

func (o fireOnce) fire() {
	if o.once == nil || o.ch == nil {
		return
	}
	o.once.Do(func() { close(o.ch) })
}

func (o fireOnce) wait() {
	if o.ch == nil {
		return
	}
	<-o.ch
}

// CancellableTimer can be used to wait on a random backoff timer. A
// pointer to a zero value of CancellableTimer if usable.
type CancellableTimer struct {
	mu sync.Mutex
	// A *time.Timer is not enough here since we need to be able to cancel the
	// timer and fire the signal (as opposed to the Stop() method on time.Timer
	// which stops the timer and prevents the signal from being fired) when
	// switching out timers.
	fo fireOnce
}

func (b *CancellableTimer) swap(newFo fireOnce) (oldFo fireOnce) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.fo, oldFo = newFo, b.fo
	return oldFo
}

func (b *CancellableTimer) get() fireOnce {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.fo
}

// StartConstant starts a backoff timer. The timer is fast-forward-able
// with b.FireNow(). Use b.Wait() to wait for the timer.
//
// It's OK to call b.Start() multiple times. It essentially resets the timer to
// a new value, i.e., any pending b.Wait() waits until the last effective timer
// completes.
func (b *CancellableTimer) StartConstant(waitDur time.Duration) {
	f := newFireOnce()
	b.swap(f).fire()
	time.AfterFunc(waitDur, f.fire)
}

// StartRandom starts a random backoff timer. The timer is fast-forward-able
// with b.FireNow(). Use b.Wait() to wait for the timer.
//
// It's OK to call b.Start() multiple times. It essentially resets the timer to
// a new value, i.e., any pending b.Wait() waits until the last effective timer
// completes.
func (b *CancellableTimer) StartRandom(maxWait time.Duration) time.Duration {
	f := newFireOnce()
	b.swap(f).fire()

	// Avoid dividing by zero if maxWait is zero.
	var waitDur time.Duration
	if maxWait != 0 {
		var buf [8]byte
		if _, err := rand.Read(buf[:]); err != nil {
			panic(err)
		}
		buf[0] &= 127 // clear the high bit, because casting to time.Duration makes it signed
		waitDur = time.Duration(binary.BigEndian.Uint64(buf[:])) % maxWait
	}
	time.AfterFunc(waitDur, f.fire)
	return waitDur
}

// Wait waits on any existing random timer. If there isn't a timer
// started, Wait() returns immediately. If b.Start() is called in the middle of
// the wait, it waits until the new timer completes (no matter it's sonner or
// later than the old timer). If FireNow() is called, Wait() returns
// immediately.
func (b *CancellableTimer) Wait() {
	var oldF fireOnce
	f := b.get()
	for f != oldF {
		f.wait()
		f, oldF = b.get(), f
	}
}

// FireNow fast-forwards any existing timer so that any Wait() calls on b wakes
// up immediately. If no timer exists, this is a no-op.
func (b *CancellableTimer) FireNow() {
	b.swap(fireOnce{}).fire()
}

// CtxFireNow is a context key that when set, causes a RPC client to reconnect
// immediately if needed.
type CtxFireNow struct{}

// WithFireNow returns a context.Context with a CtxFireNow attached.
//
// A bit more background: when random backoff is enabled, the RPC client waits
// on a random timer before trying to reconnect to server in event of a
// disconnection. However, we want this to happen only if the client device is
// idling. Users of this package should use WithFireNow to amend the context
// passed into any RPC calls that should cause a reconnect immediately. In
// general, that's all RPC calls except those that perform ping-like functions.
func WithFireNow(ctx context.Context) context.Context {
	return context.WithValue(ctx, CtxFireNow{}, true)
}

func isWithFireNow(ctx context.Context) bool {
	yes, ok := ctx.Value(CtxFireNow{}).(bool)
	return ok && yes
}
