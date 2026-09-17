// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycle_test

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
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

func stay() bool   { return true }
func noStay() bool { return false }
func noop()        {}

func noDeliveries() lifecycle.BackgroundTaskDeps {
	return lifecycle.BackgroundTaskDeps{
		ActiveDeliveries: func(context.Context) ([]chat1.OutboxRecord, error) { return nil, nil },
		NextFailure: func() (chan []chat1.OutboxRecord, func()) {
			return make(chan []chat1.OutboxRecord), func() {}
		},
		NotifyFailure: func([]chat1.OutboxRecord) {},
	}
}

func TestHoldReleaseIsIdempotent(t *testing.T) {
	appState, _ := newAppState(t)
	flushes := 0
	c := lifecycle.New(appState, lifecycle.Config{Flush: func() { flushes++ }})
	require.Zero(t, c.UIBackground(noStay))
	require.Equal(t, background, appState.State())
	require.Equal(t, 1, flushes)
	h := c.AcquireBackgroundWork(lifecycle.ReasonPushWindow)
	require.Equal(t, backgroundActive, appState.State())
	require.True(t, h.Release())
	require.True(t, h.Released())
	require.Equal(t, background, appState.State())
	require.Equal(t, 2, flushes)
	require.False(t, h.Release())
	require.Equal(t, 2, flushes)
}

// An id is never reused, so releasing an old hold again can't end a newer one.
func TestReleasingAnOldHoldNeverReleasesANewerOne(t *testing.T) {
	appState, _ := newAppState(t)
	c := lifecycle.New(appState, lifecycle.Config{})
	c.UIBackground(noStay)
	first := c.AcquireBackgroundWork(lifecycle.ReasonPushWindow)
	require.True(t, first.Release())
	second := c.AcquireBackgroundWork(lifecycle.ReasonPushWindow)
	require.NotEqual(t, first.ID(), second.ID())
	require.False(t, first.Release())
	require.False(t, second.Released())
	require.Equal(t, backgroundActive, appState.State())
	require.True(t, second.Release())
	require.Equal(t, background, appState.State())
}

func TestLaunchHoldEndsAtTheFirstUIReport(t *testing.T) {
	reports := map[string]func(c *lifecycle.Controller){
		"background": func(c *lifecycle.Controller) { c.UIBackground(noStay) },
		"inactive":   func(c *lifecycle.Controller) { c.UIInactive() },
		"active":     func(c *lifecycle.Controller) { c.UIActive() },
	}
	for name, report := range reports {
		t.Run(name, func(t *testing.T) {
			appState, _ := newAppState(t)
			appState.Update(backgroundActive)
			c := lifecycle.New(appState, lifecycle.Config{})
			require.Equal(t, 1, lifecycle.Holds(c))
			report(c)
			require.Equal(t, 0, lifecycle.Holds(c))
		})
	}
}

func TestUILeavingBackgroundEndsTaskAndSyncHolds(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	require.Positive(t, c.UIBackground(stay))
	push := c.PushWindowBegin()
	require.Positive(t, push)
	live := c.AcquireBackgroundWork(lifecycle.ReasonLiveLocation)
	synced := make(chan string, 1)
	go func() { synced <- c.BackgroundSync() }()
	require.Eventually(t, func() bool { return lifecycle.Holds(c) == 4 }, 5*time.Second, time.Millisecond)
	c.UIInactive()
	select {
	case msg := <-synced:
		require.Contains(t, msg, "bailing out early")
	case <-time.After(5 * time.Second):
		require.Fail(t, "BackgroundSync kept its window after the UI left the background")
	}
	require.Equal(t, 2, lifecycle.Holds(c))
	require.Zero(t, c.PushWindowEnd(push, stay))
	require.True(t, live.Release())
	require.Equal(t, 0, lifecycle.Holds(c))
	require.Equal(t, inactive, appState.State())
}

func TestExpirationEndsOnlyBackgroundTaskHolds(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	require.Positive(t, c.UIBackground(stay))
	push := c.PushWindowBegin()
	live := c.AcquireBackgroundWork(lifecycle.ReasonLiveLocation)
	notified := 0
	c.BackgroundTaskExpired(func() { notified++ })
	require.Equal(t, 1, notified)
	require.Equal(t, 2, lifecycle.Holds(c))
	require.Equal(t, backgroundActive, appState.State())
	c.BackgroundTaskExpired(func() { notified++ })
	require.Equal(t, 1, notified, "nothing was left to expire")
	require.Zero(t, c.PushWindowEnd(push, noStay))
	require.True(t, live.Release())
	require.Equal(t, background, appState.State())
}

func TestWillTerminateEndsEveryHold(t *testing.T) {
	appState, _ := newAppState(t)
	c := lifecycle.New(appState, lifecycle.Config{})
	live := c.AcquireBackgroundWork(lifecycle.ReasonLiveLocation)
	require.Zero(t, c.PushWindowBegin(), "no push window in the foreground")
	c.UIInactive()
	push := c.PushWindowBegin()
	require.Positive(t, push)
	c.WillTerminate(noop)
	require.Equal(t, 0, lifecycle.Holds(c))
	require.True(t, live.Released())
	require.Equal(t, background, appState.State())
	require.Zero(t, c.PushWindowEnd(push, stay))
}

func TestPushWindowEndOutsideBackgroundSkipsStayRunning(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	token := c.PushWindowBegin()
	c.UIInactive()
	called := false
	require.Zero(t, c.PushWindowEnd(token, func() bool { called = true; return true }))
	require.False(t, called)
	require.Zero(t, c.PushWindowEnd(-1, stay))
	require.Equal(t, inactive, appState.State())
	require.Equal(t, 0, lifecycle.Holds(c))
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
			prepare: func(c *lifecycle.Controller) { require.Positive(t, c.UIBackground(stay)) },
			do:      func(c *lifecycle.Controller, notifyPending func()) { c.BackgroundTaskExpired(notifyPending) },
		},
	}
	for name, event := range events {
		t.Run(name, func(t *testing.T) {
			appState, _ := newAppState(t)
			var flushes int
			c := lifecycle.New(appState, lifecycle.Config{Flush: func() { flushes++ }})
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

func TestEventString(t *testing.T) {
	require.Equal(t, "uiInactive", lifecycle.EventUIInactive.String())
	require.Equal(t, "release", lifecycle.EventRelease.String())
	require.Equal(t, "Event(99)", lifecycle.Event(99).String())
	require.Equal(t, "liveLocation", lifecycle.ReasonLiveLocation.String())
}

// Hold owners run concurrently with UI reports, then each phase ends on known
// last reports and checks nothing is left holding the app up: FOREGROUND
// stays FOREGROUND and a background UI with no work is BACKGROUND. Owner
// goroutines must all exit.
func TestHoldsStress(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{
		BackgroundSyncWindow:       200 * time.Microsecond,
		BackgroundTaskPollInterval: time.Millisecond,
		BackgroundTaskMaxDuration:  time.Minute,
	})
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
				if task := c.PushWindowEnd(token, func() bool { return r.Intn(3) == 0 }); task > 0 {
					c.RunBackgroundTask(context.Background(), task, noDeliveries())
				}
			})
			runOwner(func(*rand.Rand) { c.BackgroundSync() })
			runOwner(func(*rand.Rand) { c.BackgroundTaskExpired(noop) })
			runOwner(func(r *rand.Rand) {
				h := c.AcquireBackgroundWork(lifecycle.ReasonLiveLocation)
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
				if task := c.UIBackground(func() bool { return r.Intn(2) == 0 }); task > 0 {
					owners.Add(1)
					go func() {
						defer owners.Done()
						c.RunBackgroundTask(context.Background(), task, noDeliveries())
					}()
				}
			case 3:
				c.UIBackground(noStay)
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
		c.UIBackground(noStay)
		require.Equal(t, background, appState.State())
		require.Equal(t, 0, lifecycle.Holds(c))
	})

	t.Run("concurrent holds end in background", func(t *testing.T) {
		for range 50 {
			chaos(t, 20)
			c.UIBackground(noStay)
			var holders sync.WaitGroup
			for range 4 {
				holders.Add(1)
				go func() {
					defer holders.Done()
					c.AcquireBackgroundWork(lifecycle.ReasonPushWindow).Release()
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
