// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libcontext

import (
	"sync/atomic"
	"time"

	"golang.org/x/net/context"
)

// This file defines a set of functions for delaying context concellations.
// It's a hacky implementation and some functions require extra caution in when
// they should be called.
//
// For KBFS, this is mainly used to coupe with EINTR. Interrupts can happen
// very regularly commonly. For example, git relies SIGALRM for periodical
// progress report. Everytime SIGALRM reaches, current I/O operation gets an
// interrupt. bazil/fuse calls Cancel on context when getting an interrupt. If
// we return an error on this cancellation, application gets an EINTR. However,
// with a lot of remote operations filesystem state can sometimes be
// unpredictable, and returning EINTR might introduce inconsistency between
// application's perception of state and the real state. In addition,
// applications may not be ready in all scenarios to handle EINTR. By using
// delayed cancellation, these issues are mitigated. Specifically, KBFS uses
// this in following situations:
//
// 1. In a local filesystem, some operations (e.g. Attr) are considered "fast"
// operations. So unlike slow ones like Read or Create whose manuals explicitly
// say EINTR can happen and needs to be handled, a "fast" operation's
// documentation doesn't list EINTR as possible errors. As a result, some
// applications are not ready to handle EINTR in some of filesystem calls.
// Using delayed cancellation for such operations means if there's an interrupt
// received in the middle of the operation, it doesn't get cancelled right
// away, but instead waits for a grace period before effectively cancelling the
// context. This should allow the operation to finish in most cases -- unless
// the network condition is too bad, in which case we choose to let application
// error instead of making things unresponsive to Ctrl-C (i.e. still cancel the
// context after the grace period).
//
// 2. To be responsive to Ctrl-C, we are using runUnlessCanceled, which returns
// immediately if the context gets canceled, despite that the actual operation
// routing may still be waiting on a lock or remote operations. This means
// that, once we start a MD write, the filesystem state becomes unpredictable.
// We enable delayed cancellation here to try to avoid context being canceled
// in the middle of a MD write, also with a grace period timeout. See comments
// in folder_branch_ops.go in finalizedMDWriteLocked for more.

// CtxReplayKeyType is a type for the context key for CtxReplayFunc
type CtxReplayKeyType int

const (
	// CtxReplayKey is a context key for CtxReplayFunc
	CtxReplayKey CtxReplayKeyType = iota
)

// CtxCancellationDelayerKeyType is a type for the context key for
// using cancellationDelayer
type CtxCancellationDelayerKeyType int

const (
	// CtxCancellationDelayerKey is a context key for using cancellationDelayer
	CtxCancellationDelayerKey CtxCancellationDelayerKeyType = iota
)

// CtxReplayFunc is a function for replaying a series of changes done on a
// context.
type CtxReplayFunc func(ctx context.Context) context.Context

// CtxNotReplayableError is returned when NewContextWithReplayFrom is called on
// a ctx with no replay func.
type CtxNotReplayableError struct{}

func (e CtxNotReplayableError) Error() string {
	return "Unable to replay on ctx"
}

// NoCancellationDelayerError is returned when EnableDelayedCancellationWithGracePeriod or
// ExitCritical are called on a ctx without Critical Awareness
type NoCancellationDelayerError struct{}

func (e NoCancellationDelayerError) Error() string {
	return "Context doesn't have critical awareness or CtxCancellationDelayerKey " +
		"already exists in ctx but is not of type *cancellationDelayer"
}

// ContextAlreadyHasCancellationDelayerError is returned when
// NewContextWithCancellationDelayer is called for the second time on the same
// ctx, which is not supported yet.
type ContextAlreadyHasCancellationDelayerError struct{}

func (e ContextAlreadyHasCancellationDelayerError) Error() string {
	return "Context already has critical awareness; only one layer is supported."
}

// NewContextReplayable creates a new context from ctx, with change applied. It
// also makes this change replayable by NewContextWithReplayFrom. When
// replayed, the resulting context is replayable as well.
//
// It is important that all WithValue-ish mutations on ctx is done "replayably"
// (with NewContextReplayable) if any delayed cancellation is used, e.g.
// through EnableDelayedCancellationWithGracePeriod,
func NewContextReplayable(
	ctx context.Context, change CtxReplayFunc) context.Context {
	ctx = change(ctx)
	replays, _ := ctx.Value(CtxReplayKey).([]CtxReplayFunc)
	replays = append(replays, change)
	ctx = context.WithValue(ctx, CtxReplayKey, replays)
	return ctx
}

// NewContextWithReplayFrom constructs a new context out of ctx by calling all
// attached replay functions. This disconnects any existing context.CancelFunc.
func NewContextWithReplayFrom(ctx context.Context) (context.Context, error) {
	if replays, ok := ctx.Value(CtxReplayKey).([]CtxReplayFunc); ok {
		newCtx := context.Background()
		for _, replay := range replays {
			newCtx = replay(newCtx)
		}
		replays, _ := ctx.Value(CtxReplayKey).([]CtxReplayFunc)
		newCtx = context.WithValue(newCtx, CtxReplayKey, replays)
		return newCtx, nil
	}
	return nil, CtxNotReplayableError{}
}

type cancellationDelayer struct {
	delay    int64
	canceled int64

	done chan struct{}
}

func newCancellationDelayer() *cancellationDelayer {
	return &cancellationDelayer{
		done: make(chan struct{}),
	}
}

// NewContextWithCancellationDelayer creates a new context out of ctx. All replay
// functions attached to ctx are run on the new context. In addition, the
// new context is made "cancellation delayable". That is, it disconnects the cancelFunc
// from ctx, and watch for the cancellation. When cancellation happens, it
// checks if delayed cancellation is enabled for the associated context. If so,
// it waits until it's disabled before cancelling the new context. This
// provides a hacky way to allow finer control over cancellation.
//
// Note that, it's important to call context.WithCancel (or its friends) before
// this function if those cancellations need to be controllable ("cancellation
// delayable"). Otherwise, the new cancelFunc is inherently NOT ("cancellation
// delayable").
//
// If this function is called, it is caller's responsibility to either 1)
// cancel ctx (the context passed in); or 2) call CleanupCancellationDelayer;
// when operations associated with the context is done. Otherwise it leaks go
// routines!
func NewContextWithCancellationDelayer(
	ctx context.Context) (newCtx context.Context, err error) {
	v := ctx.Value(CtxCancellationDelayerKey)
	if v != nil {
		if _, ok := v.(*cancellationDelayer); ok {
			return nil, ContextAlreadyHasCancellationDelayerError{}
		}
		return nil, NoCancellationDelayerError{}
	}

	if newCtx, err = NewContextWithReplayFrom(ctx); err != nil {
		return nil, err
	}
	c := newCancellationDelayer()
	newCtx = NewContextReplayable(newCtx,
		func(ctx context.Context) context.Context {
			return context.WithValue(ctx, CtxCancellationDelayerKey, c)
		})
	newCtx, cancel := context.WithCancel(newCtx)
	go func() {
		select {
		case <-ctx.Done():
		case <-c.done:
		}
		d := time.Duration(atomic.LoadInt64(&c.delay))
		if d != 0 {
			time.Sleep(d)
		}
		atomic.StoreInt64(&c.canceled, 1)
		cancel()
	}()
	return newCtx, nil
}

// EnableDelayedCancellationWithGracePeriod can be called on a "cancellation
// delayable" context produced by NewContextWithCancellationDelayer, to enable
// delayed cancellation for ctx. This is useful to indicate that the
// operation(s) associated with the context has entered a critical state, and
// it should not be canceled until after timeout or CleanupCancellationDelayer
// is called.
//
// Note that if EnableDelayedCancellationWithGracePeriod is called for the
// second time, and the grace period has started due to a cancellation, the
// grace period would not be extended (i.e. timeout has no effect in this
// case). Although in this case, no error is returned, since the delayed
// cancellation is already enabled.
func EnableDelayedCancellationWithGracePeriod(ctx context.Context, timeout time.Duration) error {
	if c, ok := ctx.Value(CtxCancellationDelayerKey).(*cancellationDelayer); ok {
		if atomic.LoadInt64(&c.canceled) > 0 {
			// Too late! The parent context is already canceled and timer has already
			// started.
			return context.Canceled
		}
		atomic.StoreInt64(&c.delay, int64(timeout))
		return nil
	}
	return NoCancellationDelayerError{}
}

// CleanupCancellationDelayer cleans up a context (ctx) that is cancellation
// delayable and makes the go routine spawned in
// NewContextWithCancellationDelayer exit. As part of the cleanup, this also
// causes the cancellation delayable context to be canceled, no matter whether
// the timeout passed into the EnableDelayedCancellationWithGracePeriod has
// passed or not.
//
// Ideally, the parent ctx's cancelFunc is always called upon completion of
// handling a request, in which case this wouldn't be necessary.
func CleanupCancellationDelayer(ctx context.Context) error {
	if c, ok := ctx.Value(CtxCancellationDelayerKey).(*cancellationDelayer); ok {
		close(c.done)
		return nil
	}
	return NoCancellationDelayerError{}
}

// BackgroundContextWithCancellationDelayer generate a "Background"
// context that is cancellation delayable
func BackgroundContextWithCancellationDelayer() context.Context {
	if ctx, err := NewContextWithCancellationDelayer(NewContextReplayable(
		context.Background(), func(c context.Context) context.Context {
			return c
		})); err != nil {
		panic(err)
	} else {
		return ctx
	}
}
