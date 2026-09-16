// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"context"
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

const (
	foreground       = keybase1.MobileAppState_FOREGROUND
	background       = keybase1.MobileAppState_BACKGROUND
	backgroundActive = keybase1.MobileAppState_BACKGROUNDACTIVE
)

type flushCounter struct{ n atomic.Int32 }

func (f *flushCounter) flush()     { f.n.Add(1) }
func (f *flushCounter) count() int { return int(f.n.Load()) }

func newTestAppState(t *testing.T, initial keybase1.MobileAppState) *libkb.MobileAppState {
	tc := libkb.SetupTest(t, t.Name(), 0)
	t.Cleanup(tc.Cleanup)
	appState := libkb.NewMobileAppState(tc.G)
	appState.Update(initial)
	return appState
}

// waitForGeneration blocks until the app state generation moves past gen.
func waitForGeneration(t *testing.T, appState *libkb.MobileAppState, gen uint64) {
	t.Helper()
	require.Eventually(t, func() bool {
		_, cur := appState.StateAndGeneration()
		return cur > gen
	}, 5*time.Second, time.Millisecond)
}

func TestBackgroundSyncWindowCompletes(t *testing.T) {
	appState := newTestAppState(t, background)
	var flushes flushCounter
	msg := runBackgroundSyncWindow(appState, 10*time.Millisecond, flushes.flush)
	require.Equal(t, "completed window", msg)
	require.Equal(t, background, appState.State())
	require.Equal(t, 1, flushes.count())
}

func TestBackgroundSyncWindowSkipsOutsideBackground(t *testing.T) {
	for _, initial := range []keybase1.MobileAppState{foreground, backgroundActive, keybase1.MobileAppState_INACTIVE} {
		appState := newTestAppState(t, initial)
		_, gen := appState.StateAndGeneration()
		msg := runBackgroundSyncWindow(appState, time.Millisecond, func() {})
		require.Contains(t, msg, "skipping")
		state, cur := appState.StateAndGeneration()
		require.Equal(t, initial, state)
		require.Equal(t, gen, cur)
	}
}

// iOS willEnterForeground reports BACKGROUNDACTIVE, the value the window
// already holds; the window must not return to BACKGROUND over it.
func TestBackgroundSyncWindowWillEnterForegroundMidWindow(t *testing.T) {
	appState := newTestAppState(t, background)
	_, gen := appState.StateAndGeneration()
	var flushes flushCounter
	done := make(chan string)
	go func() { done <- runBackgroundSyncWindow(appState, 200*time.Millisecond, flushes.flush) }()
	waitForGeneration(t, appState, gen)
	appState.Update(backgroundActive)

	msg := <-done
	require.Contains(t, msg, "updated meanwhile")
	require.Equal(t, backgroundActive, appState.State())
	require.Equal(t, 0, flushes.count())

	appState.Update(foreground)
	require.Equal(t, foreground, appState.State())
}

func TestBackgroundSyncWindowForegroundMidWindow(t *testing.T) {
	appState := newTestAppState(t, background)
	_, gen := appState.StateAndGeneration()
	done := make(chan string)
	go func() { done <- runBackgroundSyncWindow(appState, time.Minute, func() {}) }()
	waitForGeneration(t, appState, gen)
	appState.Update(foreground)
	require.Contains(t, <-done, "bailing out early")
	require.Equal(t, foreground, appState.State())
}

type fakeDeliverer struct {
	mu       sync.Mutex
	pending  []chat1.OutboxRecord
	failures chan []chat1.OutboxRecord
	notified atomic.Int32
	polls    atomic.Int32
}

func newFakeDeliverer(pending int) *fakeDeliverer {
	return &fakeDeliverer{
		pending:  make([]chat1.OutboxRecord, pending),
		failures: make(chan []chat1.OutboxRecord, 1),
	}
}

func (f *fakeDeliverer) setPending(n int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pending = make([]chat1.OutboxRecord, n)
}

func (f *fakeDeliverer) deps(maxDuration time.Duration) backgroundTaskDeps {
	return backgroundTaskDeps{
		activeDeliveries: func(context.Context) ([]chat1.OutboxRecord, error) {
			f.polls.Add(1)
			f.mu.Lock()
			defer f.mu.Unlock()
			return f.pending, nil
		},
		nextFailure:   func() (chan []chat1.OutboxRecord, func()) { return f.failures, func() {} },
		notifyFailure: func([]chat1.OutboxRecord) { f.notified.Add(1) },
		debug:         func(string, ...interface{}) {},
		pollInterval:  time.Millisecond,
		maxDuration:   maxDuration,
	}
}

func startBackgroundTask(appState *libkb.MobileAppState, taskGen *atomic.Uint64, d *fakeDeliverer,
	maxDuration time.Duration, flush func(),
) chan struct{} {
	done := make(chan struct{})
	go func() {
		runBackgroundTask(context.Background(), appState, taskGen, d.deps(maxDuration), flush)
		close(done)
	}()
	return done
}

// waitForPolling blocks until the background task is past its window check.
func (f *fakeDeliverer) waitForPolling(t *testing.T) {
	t.Helper()
	require.Eventually(t, func() bool { return f.polls.Load() > 0 }, 5*time.Second, time.Millisecond)
}

func requireDone(t *testing.T, done chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		require.Fail(t, "background task did not finish")
	}
}

func TestEnterBackground(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	var flushes flushCounter

	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))
	state, gen := appState.StateAndGeneration()
	require.Equal(t, backgroundActive, state)
	require.Equal(t, gen, taskGen.Load())
	require.Equal(t, 1, flushes.count())

	require.False(t, enterBackground(appState, false, &taskGen, flushes.flush))
	require.Equal(t, background, appState.State())
	require.Zero(t, taskGen.Load())
	require.Equal(t, 2, flushes.count())
}

func TestBackgroundTaskReturnsToBackgroundWhenDelivered(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	var flushes flushCounter
	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))

	d := newFakeDeliverer(0)
	requireDone(t, startBackgroundTask(appState, &taskGen, d, time.Minute, flushes.flush))
	require.Equal(t, background, appState.State())
	require.Equal(t, 2, flushes.count())
	require.Zero(t, taskGen.Load())
	require.Zero(t, d.notified.Load())
}

func TestBackgroundTaskReturnsToBackgroundOnFailure(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	require.True(t, enterBackground(appState, true, &taskGen, func() {}))

	d := newFakeDeliverer(1)
	d.failures <- make([]chat1.OutboxRecord, 1)
	requireDone(t, startBackgroundTask(appState, &taskGen, d, time.Minute, func() {}))
	require.Equal(t, background, appState.State())
	require.Equal(t, int32(1), d.notified.Load())
}

func TestBackgroundTaskReturnsToBackgroundWhenTimeExpires(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	require.True(t, enterBackground(appState, true, &taskGen, func() {}))

	d := newFakeDeliverer(1)
	requireDone(t, startBackgroundTask(appState, &taskGen, d, 20*time.Millisecond, func() {}))
	require.Equal(t, background, appState.State())
	require.Equal(t, int32(1), d.notified.Load())
}

func TestBackgroundTaskExitsOnForeground(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	require.True(t, enterBackground(appState, true, &taskGen, func() {}))

	d := newFakeDeliverer(1)
	done := startBackgroundTask(appState, &taskGen, d, time.Minute, func() {})
	d.waitForPolling(t)
	appState.Update(foreground)
	requireDone(t, done)
	require.Equal(t, foreground, appState.State())
}

// willEnterForeground's same-value BACKGROUNDACTIVE doesn't wake the task;
// when deliveries finish afterwards, the task must leave the state alone.
func TestBackgroundTaskExitAfterWillEnterForeground(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	var flushes flushCounter
	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))

	d := newFakeDeliverer(1)
	done := startBackgroundTask(appState, &taskGen, d, time.Minute, flushes.flush)
	d.waitForPolling(t)
	appState.Update(backgroundActive)
	d.setPending(0)
	requireDone(t, done)
	require.Equal(t, backgroundActive, appState.State())
	require.Equal(t, 1, flushes.count())

	appState.Update(foreground)
	require.Equal(t, foreground, appState.State())
}

func TestBackgroundTaskWithoutWindowEarlyOut(t *testing.T) {
	appState := newTestAppState(t, backgroundActive)
	var taskGen atomic.Uint64
	d := newFakeDeliverer(0)
	requireDone(t, startBackgroundTask(appState, &taskGen, d, time.Minute, func() {}))
	require.Equal(t, backgroundActive, appState.State())

	// A window whose generation was superseded is not the task's to close.
	require.True(t, enterBackground(appState, true, &taskGen, func() {}))
	appState.Update(backgroundActive)
	requireDone(t, startBackgroundTask(appState, &taskGen, d, time.Minute, func() {}))
	require.Equal(t, backgroundActive, appState.State())
}

func TestBackgroundTaskExpiredInWindow(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	var flushes flushCounter
	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))

	expireBackgroundTask(appState, &taskGen, flushes.flush)
	require.Equal(t, background, appState.State())
	require.Equal(t, 2, flushes.count())
	require.Zero(t, taskGen.Load())

	// A second expiration has no window to close.
	appState.Update(foreground)
	expireBackgroundTask(appState, &taskGen, flushes.flush)
	require.Equal(t, foreground, appState.State())
}

func TestBackgroundTaskExpiredAfterForeground(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	var flushes flushCounter
	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))

	appState.Update(backgroundActive) // willEnterForeground
	appState.Update(foreground)       // didBecomeActive
	expireBackgroundTask(appState, &taskGen, flushes.flush)
	require.Equal(t, foreground, appState.State())
	require.Equal(t, 1, flushes.count())
}

// The expiration arriving after the task already closed its window must not
// close a window that isn't there.
func TestBackgroundTaskExpiredAfterTaskFinished(t *testing.T) {
	appState := newTestAppState(t, foreground)
	var taskGen atomic.Uint64
	require.True(t, enterBackground(appState, true, &taskGen, func() {}))
	requireDone(t, startBackgroundTask(appState, &taskGen, newFakeDeliverer(0), time.Minute, func() {}))
	require.Equal(t, background, appState.State())

	appState.Update(foreground)
	expireBackgroundTask(appState, &taskGen, func() {})
	require.Equal(t, foreground, appState.State())
}

func TestPushWindow(t *testing.T) {
	appState := newTestAppState(t, background)
	var taskGen atomic.Uint64
	var flushes flushCounter
	stay := func(v bool) func() bool { return func() bool { return v } }

	token := beginPushWindow(appState)
	require.Positive(t, token)
	require.Equal(t, backgroundActive, appState.State())
	require.False(t, endPushWindow(appState, token, stay(false), &taskGen, flushes.flush))
	require.Equal(t, background, appState.State())
	require.Equal(t, 1, flushes.count())

	appState.Update(foreground)
	require.Zero(t, beginPushWindow(appState))
	require.Equal(t, foreground, appState.State())
	require.False(t, endPushWindow(appState, 0, stay(false), &taskGen, flushes.flush))
	require.False(t, endPushWindow(appState, -1, stay(false), &taskGen, flushes.flush))
	require.Equal(t, foreground, appState.State())
}

func TestPushWindowForegroundInBetween(t *testing.T) {
	appState := newTestAppState(t, background)
	var taskGen atomic.Uint64
	var flushes flushCounter

	token := beginPushWindow(appState)
	require.Positive(t, token)
	appState.Update(foreground)
	require.False(t, endPushWindow(appState, token, func() bool { return false }, &taskGen, flushes.flush))
	require.Equal(t, foreground, appState.State())
	require.Zero(t, flushes.count())

	token = beginPushWindow(appState)
	require.Zero(t, token)

	// A foreground and a return to the background in between: the window is
	// no longer the push handler's, even though the value matches.
	appState.Update(backgroundActive)
	token = beginPushWindow(appState)
	require.Positive(t, token)
	appState.Update(foreground)
	require.True(t, enterBackground(appState, true, &taskGen, flushes.flush))
	_, gen := appState.StateAndGeneration()
	require.False(t, endPushWindow(appState, token, func() bool { return false }, &taskGen, flushes.flush))
	require.Equal(t, backgroundActive, appState.State())
	require.Equal(t, gen, taskGen.Load(), "the background task window stays open")
	require.False(t, endPushWindow(appState, token, func() bool { return true }, &taskGen, flushes.flush))
	require.Equal(t, gen, taskGen.Load())
}

func TestPushWindowOverlapping(t *testing.T) {
	appState := newTestAppState(t, background)
	var taskGen atomic.Uint64
	first := beginPushWindow(appState)
	second := beginPushWindow(appState)
	require.Positive(t, first)
	require.Greater(t, second, first)

	require.False(t, endPushWindow(appState, first, func() bool { return false }, &taskGen, func() {}))
	require.Equal(t, backgroundActive, appState.State(), "the later window is still open")
	require.False(t, endPushWindow(appState, second, func() bool { return false }, &taskGen, func() {}))
	require.Equal(t, background, appState.State())
}

func TestPushWindowHandsOverToBackgroundTask(t *testing.T) {
	appState := newTestAppState(t, background)
	var taskGen atomic.Uint64
	token := beginPushWindow(appState)
	require.True(t, endPushWindow(appState, token, func() bool { return true }, &taskGen, func() {}))
	_, gen := appState.StateAndGeneration()
	require.Equal(t, gen, taskGen.Load())
	require.Equal(t, backgroundActive, appState.State())

	requireDone(t, startBackgroundTask(appState, &taskGen, newFakeDeliverer(0), time.Minute, func() {}))
	require.Equal(t, background, appState.State())
}

// Owners run concurrently with lifecycle events. Once the last lifecycle event
// is FOREGROUND and every owner has finished, no owner may have moved the app
// out of FOREGROUND.
func TestAppStateOwnersStress(t *testing.T) {
	appState := newTestAppState(t, background)
	var taskGen atomic.Uint64
	flush := func() {}
	const iterations = 300

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
	for range 4 {
		runOwner(func(r *rand.Rand) {
			token := beginPushWindow(appState)
			if r.Intn(2) == 0 {
				time.Sleep(time.Duration(r.Intn(100)) * time.Microsecond)
			}
			if endPushWindow(appState, token, func() bool { return r.Intn(3) == 0 }, &taskGen, flush) {
				runBackgroundTask(context.Background(), appState, &taskGen,
					newFakeDeliverer(0).deps(time.Minute), flush)
			}
		})
		runOwner(func(r *rand.Rand) {
			runBackgroundSyncWindow(appState, time.Duration(r.Intn(200))*time.Microsecond, flush)
		})
		runOwner(func(*rand.Rand) {
			expireBackgroundTask(appState, &taskGen, flush)
		})
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	for range iterations {
		switch r.Intn(5) {
		case 0:
			appState.Update(foreground)
		case 1:
			appState.Update(backgroundActive)
		case 2:
			appState.Update(keybase1.MobileAppState_INACTIVE)
		case 3:
			enterBackground(appState, r.Intn(2) == 0, &taskGen, flush)
		case 4:
			appState.Update(background)
		}
		time.Sleep(time.Duration(r.Intn(50)) * time.Microsecond)
	}
	appState.Update(foreground)
	close(lifecycleDone)

	done := make(chan struct{})
	go func() {
		owners.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		require.Fail(t, "owners deadlocked")
	}
	require.Equal(t, foreground, appState.State())
}
