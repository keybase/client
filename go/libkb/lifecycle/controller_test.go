// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycle_test

import (
	"context"
	"errors"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

const (
	foreground       = keybase1.MobileAppState_FOREGROUND
	background       = keybase1.MobileAppState_BACKGROUND
	backgroundActive = keybase1.MobileAppState_BACKGROUNDACTIVE
	inactive         = keybase1.MobileAppState_INACTIVE
)

func noop() {}

// noDeliveries starts a task that finds nothing to deliver; stay says whether
// it keeps polling first.
func noDeliveries(stay bool) lifecycle.BackgroundTaskDeps {
	return lifecycle.BackgroundTaskDeps{
		Stay:             func() bool { return stay },
		ActiveDeliveries: func(context.Context) ([]chat1.OutboxRecord, error) { return nil, nil },
		NextFailure: func() (chan []chat1.OutboxRecord, func()) {
			return make(chan []chat1.OutboxRecord), func() {}
		},
		NotifyFailure: func([]chat1.OutboxRecord) {},
	}
}

// An id is never reused, so releasing an old hold again can't end a newer one.
func TestHoldReleaseIsIdempotent(t *testing.T) {
	appState, _ := newAppState(t)
	flushes := 0
	c := lifecycle.New(appState, lifecycle.Config{Flush: func() { flushes++ }})
	token := c.UIBackground(noDeliveries(false))
	require.Positive(t, token)
	c.WaitBackgroundTask(token)
	require.Equal(t, background, appState.State())
	// Into BACKGROUNDACTIVE, then out of it.
	require.Equal(t, 2, flushes)
	first := c.AcquireBackgroundWork()
	require.Equal(t, backgroundActive, appState.State())
	require.True(t, first.Release())
	require.Zero(t, lifecycle.Holds(c))
	require.Equal(t, background, appState.State())
	require.Equal(t, 3, flushes)
	second := c.AcquireBackgroundWork()
	require.False(t, first.Release())
	// The stale Release left the newer hold alone.
	require.Equal(t, 1, lifecycle.Holds(c))
	require.Equal(t, backgroundActive, appState.State())
	require.True(t, second.Release())
	require.Equal(t, background, appState.State())
	require.Equal(t, 4, flushes)
}

// Close waits for the running background tasks, so no later call may start
// one: a task that joined the wait afterwards would be a WaitGroup misuse.
func TestNoTaskStartsAfterClose(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	c.Close()

	require.Zero(t, c.UIBackground(noDeliveries(true)), "UIBackground started a task after Close")
	require.Zero(t, lifecycle.Holds(c))
	require.Equal(t, background, appState.State())

	// PushWindowEnd's hand-over to a task is gated the same way; the push
	// window's own hold is not.
	push := c.PushWindowBegin()
	require.Positive(t, push)
	require.Equal(t, backgroundActive, appState.State())
	require.Zero(t, c.PushWindowEnd(push, true, noDeliveries(true)), "PushWindowEnd started a task after Close")
	require.Zero(t, lifecycle.Holds(c))
	require.Equal(t, background, appState.State())
}

func TestExpirationEndsOnlyBackgroundTaskHolds(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	defer c.Close()
	require.Positive(t, c.UIBackground(noDeliveries(true)))
	push := c.PushWindowBegin()
	live := c.AcquireBackgroundWork()
	notified := 0
	c.BackgroundTaskExpired(func() { notified++ })
	require.Equal(t, 1, notified)
	require.Equal(t, 2, lifecycle.Holds(c))
	require.Equal(t, backgroundActive, appState.State())
	c.BackgroundTaskExpired(func() { notified++ })
	require.Equal(t, 1, notified, "nothing was left to expire")
	require.Zero(t, c.PushWindowEnd(push, false, noDeliveries(true)))
	require.True(t, live.Release())
	require.Equal(t, background, appState.State())
}

// A start while a background task runs, from a duplicate didEnterBackground
// or a push window's end, joins that task: one task keeps the app up, and a
// failed message is warned about once.
func TestBackgroundTaskStartsJoinTheRunningTask(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	defer c.Close()
	var mu sync.Mutex
	var subscribers []chan []chat1.OutboxRecord
	subscribed := make(chan struct{}, 10)
	var notified atomic.Int32
	deps := noDeliveries(true)
	deps.NextFailure = func() (chan []chat1.OutboxRecord, func()) {
		ch := make(chan []chat1.OutboxRecord, 1)
		mu.Lock()
		subscribers = append(subscribers, ch)
		mu.Unlock()
		subscribed <- struct{}{}
		return ch, func() {}
	}
	deps.NotifyFailure = func([]chat1.OutboxRecord) { notified.Add(1) }

	first := c.UIBackground(deps)
	require.Positive(t, first)
	select {
	case <-subscribed:
	case <-time.After(5 * time.Second):
		require.Fail(t, "the background task never watched for failures")
	}
	require.Equal(t, first, c.UIBackground(deps), "a duplicate didEnterBackground")
	push := c.PushWindowBegin()
	require.Equal(t, first, c.PushWindowEnd(push, true, deps), "a push window's end")
	require.Equal(t, 1, lifecycle.Holds(c))

	// The outbox tells every watcher about a failure.
	mu.Lock()
	for _, ch := range subscribers {
		ch <- make([]chat1.OutboxRecord, 1)
	}
	mu.Unlock()
	c.WaitBackgroundTask(first)
	require.Equal(t, background, appState.State())
	require.EqualValues(t, 1, notified.Load())
}

// startPolledTask starts a background task on a fake clock. Its done closes
// once the task has ended.
func startPolledTask(t *testing.T, maxDuration time.Duration, deps lifecycle.BackgroundTaskDeps) (
	appState *libkb.MobileAppState, clock *lifecycletest.FakeClock, done chan struct{},
) {
	appState, _ = newAppState(t)
	appState.Update(background)
	clock = lifecycletest.NewFakeClock()
	c := lifecycle.New(appState, lifecycle.Config{
		Clock:                      clock,
		BackgroundTaskPollInterval: pollInterval,
		BackgroundTaskMaxDuration:  maxDuration,
	})
	t.Cleanup(c.Close)
	token := c.UIBackground(deps)
	require.Positive(t, token)
	done = make(chan struct{})
	go func() {
		defer close(done)
		c.WaitBackgroundTask(token)
	}()
	return appState, clock, done
}

const pollInterval = 5 * time.Second

// advancePolls lets a background task poll until it ends, at most limit
// times, and returns how many polls it took.
func advancePolls(t *testing.T, clock *lifecycletest.FakeClock, done chan struct{}, limit int) int {
	for n := range limit {
		if !clock.WaitForAfter(t, pollInterval, done) {
			return n
		}
		clock.Advance(pollInterval)
	}
	return limit
}

// The maximum duration holds even while the outbox can't be read.
func TestBackgroundTaskTimesOutWhileDeliveriesFail(t *testing.T) {
	var notified atomic.Int32
	deps := noDeliveries(true)
	deps.ActiveDeliveries = func(context.Context) ([]chat1.OutboxRecord, error) {
		return nil, errors.New("outbox unavailable")
	}
	deps.NotifyFailure = func([]chat1.OutboxRecord) { notified.Add(1) }
	appState, clock, done := startPolledTask(t, 3*pollInterval, deps)
	require.Equal(t, 3, advancePolls(t, clock, done, 10), "the task outlived its maximum duration")
	require.EqualValues(t, 1, notified.Load())
	require.Equal(t, background, appState.State())
}

// Deliveries that reappear start the count of empty polls over.
func TestBackgroundTaskNeedsEmptyPollsInARow(t *testing.T) {
	outbox := [][]chat1.OutboxRecord{nil, nil, make([]chat1.OutboxRecord, 1), nil, nil, nil}
	var polls atomic.Int32
	var notified atomic.Int32
	deps := noDeliveries(true)
	deps.ActiveDeliveries = func(context.Context) ([]chat1.OutboxRecord, error) {
		if i := int(polls.Add(1)) - 1; i < len(outbox) {
			return outbox[i], nil
		}
		return nil, nil
	}
	deps.NotifyFailure = func([]chat1.OutboxRecord) { notified.Add(1) }
	appState, clock, done := startPolledTask(t, lifecycle.DefaultBackgroundTaskMaxDuration, deps)
	require.Equal(t, len(outbox), advancePolls(t, clock, done, 10), "the task ended with a message still sending")
	require.Zero(t, notified.Load())
	require.Equal(t, background, appState.State())
}

// Native gives these last events only a short wait, so the state change and
// the flush must happen before the slow pending-message warning.
func TestExitEventsApplyBeforeNotifying(t *testing.T) {
	events := map[string]struct {
		prepare func(c *lifecycle.Controller)
		do      func(c *lifecycle.Controller, notifyPending func())
	}{
		"willTerminate": {
			prepare: func(c *lifecycle.Controller) { c.UIActive() },
			do:      func(c *lifecycle.Controller, notifyPending func()) { c.WillTerminate(notifyPending) },
		},
		"backgroundTaskExpired": {
			prepare: func(c *lifecycle.Controller) { require.Positive(t, c.UIBackground(noDeliveries(true))) },
			do:      func(c *lifecycle.Controller, notifyPending func()) { c.BackgroundTaskExpired(notifyPending) },
		},
	}
	for name, event := range events {
		t.Run(name, func(t *testing.T) {
			appState, _ := newAppState(t)
			var flushes int
			c := lifecycle.New(appState, lifecycle.Config{Flush: func() { flushes++ }})
			defer c.Close()
			event.prepare(c)
			flushesBefore := flushes
			notified := false
			event.do(c, func() {
				notified = true
				require.Equal(t, background, appState.State())
				require.Equal(t, flushesBefore+1, flushes)
			})
			require.True(t, notified)
		})
	}
}

// Hold owners run concurrently with UI reports, then each phase ends on known
// last reports and checks nothing is left holding the app up: FOREGROUND
// stays FOREGROUND and a background UI with no work is BACKGROUND. Owner
// goroutines and the background tasks the controller runs must all exit.
func TestHoldsStress(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{
		BackgroundSyncWindow:       200 * time.Microsecond,
		BackgroundTaskPollInterval: time.Millisecond,
		BackgroundTaskMaxDuration:  time.Minute,
	})
	defer c.Close()
	baseline := runtime.NumGoroutine()

	chaos := func(t *testing.T, iterations int) {
		var owners sync.WaitGroup
		lifecycleDone := make(chan struct{})
		runOwner := func(f func(r *rand.Rand)) {
			owners.Add(1)
			go func(seed int64) {
				defer owners.Done()
				r := rand.New(rand.NewSource(seed))
				for {
					select {
					case <-lifecycleDone:
						return
					default:
					}
					f(r)
				}
			}(rand.Int63())
		}
		for range 3 {
			runOwner(func(r *rand.Rand) {
				token := c.PushWindowBegin()
				if r.Intn(2) == 0 {
					time.Sleep(time.Duration(r.Intn(100)) * time.Microsecond)
				}
				c.PushWindowEnd(token, r.Intn(2) == 0, noDeliveries(r.Intn(3) == 0))
			})
			runOwner(func(*rand.Rand) { c.BackgroundSync() })
			runOwner(func(*rand.Rand) { c.BackgroundTaskExpired(noop) })
			runOwner(func(r *rand.Rand) {
				h := c.AcquireBackgroundWork()
				time.Sleep(time.Duration(r.Intn(100)) * time.Microsecond)
				h.Release()
			})
		}

		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		for range iterations {
			switch r.Intn(5) {
			case 0:
				c.UIActive()
			case 1:
				c.UIInactive()
			case 2:
				c.UIBackground(noDeliveries(r.Intn(2) == 0))
			case 3:
				c.UIBackground(noDeliveries(false))
			case 4:
				if r.Intn(10) == 0 {
					c.WillTerminate(noop)
				}
			}
			time.Sleep(time.Duration(r.Intn(50)) * time.Microsecond)
		}
		c.UIActive()
		close(lifecycleDone)
		waitGroupWithin(t, &owners, "owners deadlocked")
		require.Equal(t, foreground, appState.State())
		require.Equal(t, 0, lifecycle.Holds(c))
	}

	t.Run("ends in foreground", func(t *testing.T) {
		chaos(t, 300)
	})

	t.Run("ends in background", func(t *testing.T) {
		chaos(t, 300)
		c.WaitBackgroundTask(c.UIBackground(noDeliveries(false)))
		require.Equal(t, background, appState.State())
		require.Equal(t, 0, lifecycle.Holds(c))
	})

	t.Run("concurrent holds end in background", func(t *testing.T) {
		for range 50 {
			chaos(t, 20)
			c.WaitBackgroundTask(c.UIBackground(noDeliveries(false)))
			var holders sync.WaitGroup
			for range 4 {
				holders.Add(1)
				go func() {
					defer holders.Done()
					c.AcquireBackgroundWork().Release()
				}()
			}
			waitGroupWithin(t, &holders, "holders deadlocked")
			require.Equal(t, background, appState.State())
			require.Equal(t, 0, lifecycle.Holds(c))
		}
	})

	// require.Eventually runs its condition on extra goroutines, so poll by hand.
	settled := runtime.NumGoroutine()
	for deadline := time.Now().Add(5 * time.Second); settled > baseline && time.Now().Before(deadline); {
		time.Sleep(10 * time.Millisecond)
		settled = runtime.NumGoroutine()
	}
	require.LessOrEqual(t, settled, baseline, "leaked goroutines")
	t.Logf("goroutines: baseline %d, settled %d", baseline, settled)
}

func waitGroupWithin(t *testing.T, wg *sync.WaitGroup, msg string) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		require.Fail(t, msg)
	}
}

var _ lifecycle.AppState = (*libkb.MobileAppState)(nil)
