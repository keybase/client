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

func requireDone(t *testing.T, done chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		require.Fail(t, "did not finish")
	}
}

// Two windows open concurrently and record their generations in the opposite
// order; the newer window must stay recorded so its task can close it.
func TestWindowsRecordedOutOfOrder(t *testing.T) {
	openers := map[string]func(*lifecycle.Controller){
		"didEnterBackground": func(c *lifecycle.Controller) { c.DidEnterBackground(stay) },
		"pushWindowEnd":      func(c *lifecycle.Controller) { c.PushWindowEnd(c.PushWindowBegin(), stay) },
	}
	for name, openFirst := range openers {
		t.Run(name, func(t *testing.T) {
			appState, _ := newAppState(t)
			appState.Update(background)
			c := lifecycle.New(appState, lifecycle.Config{BackgroundTaskPollInterval: time.Millisecond})
			paused := make(chan struct{})
			release := make(chan struct{})
			calls := 0
			var mu sync.Mutex
			lifecycle.SetTestHookAfterWindowUpdate(c, func() {
				mu.Lock()
				calls++
				first := calls == 1
				mu.Unlock()
				if first {
					close(paused)
					<-release
				}
			})

			firstDone := make(chan struct{})
			go func() {
				openFirst(c)
				close(firstDone)
			}()
			<-paused
			require.True(t, c.DidEnterBackground(stay))
			_, newest := appState.StateAndGeneration()
			close(release)
			requireDone(t, firstDone)
			require.Equal(t, newest, lifecycle.TaskGen(c))

			c.RunBackgroundTask(context.Background(), noDeliveries())
			require.Equal(t, background, appState.State())
		})
	}
}

func TestLiveLocationClaimsRecordedOutOfOrder(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	paused := make(chan struct{})
	release := make(chan struct{})
	calls := 0
	var mu sync.Mutex
	lifecycle.SetTestHookAfterWindowUpdate(c, func() {
		mu.Lock()
		calls++
		first := calls == 1
		mu.Unlock()
		if first {
			close(paused)
			<-release
		}
	})
	firstDone := make(chan struct{})
	go func() {
		c.LiveLocationClaim()
		close(firstDone)
	}()
	<-paused
	// Another owner's round trip, then a newer claim.
	appState.Update(background)
	c.LiveLocationClaim()
	close(release)
	requireDone(t, firstDone)
	c.LiveLocationRelease()
	require.Equal(t, background, appState.State())
}

func TestPushWindowEndStaleTokenSkipsStayRunning(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{})
	token := c.PushWindowBegin()
	c.DidBecomeActive()
	called := false
	require.False(t, c.PushWindowEnd(token, func() bool {
		called = true
		return true
	}))
	require.False(t, called)
	require.False(t, c.PushWindowEnd(-1, stay))
	require.Equal(t, foreground, appState.State())
}

func TestEventString(t *testing.T) {
	require.Equal(t, "willEnterForeground", lifecycle.EventWillEnterForeground.String())
	require.Equal(t, "liveLocationRelease", lifecycle.EventLiveLocationRelease.String())
	require.Equal(t, "Event(99)", lifecycle.Event(99).String())
}

// Owners run concurrently with lifecycle events, then each phase ends on a
// known last event and checks nothing is left stuck: FOREGROUND stays
// FOREGROUND, a background task window closes to BACKGROUND, and a plain
// BACKGROUND stays BACKGROUND. Owner goroutines must all exit.
func TestOwnersStress(t *testing.T) {
	appState, _ := newAppState(t)
	appState.Update(background)
	c := lifecycle.New(appState, lifecycle.Config{
		BackgroundSyncWindow:       200 * time.Microsecond,
		BackgroundTaskPollInterval: time.Millisecond,
		BackgroundTaskMaxDuration:  time.Minute,
	})
	// Widen the gap between opening a window and recording it, where a
	// competing opener can slip in.
	lifecycle.SetTestHookAfterWindowUpdate(c, func() {
		if rand.Intn(2) == 0 {
			time.Sleep(time.Duration(rand.Intn(200)) * time.Microsecond)
		}
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
				if c.PushWindowEnd(token, func() bool { return r.Intn(3) == 0 }) {
					c.RunBackgroundTask(context.Background(), noDeliveries())
				}
			})
			runOwner(func(*rand.Rand) { c.BackgroundSync() })
			runOwner(func(*rand.Rand) { c.BackgroundTaskExpired(noop) })
			runOwner(func(r *rand.Rand) {
				c.LiveLocationClaim()
				time.Sleep(time.Duration(r.Intn(100)) * time.Microsecond)
				c.LiveLocationRelease()
			})
		}

		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		for range iterations {
			switch r.Intn(6) {
			case 0:
				c.DidBecomeActive()
			case 1:
				c.WillEnterForeground()
			case 2:
				c.WillResignActive()
			case 3:
				c.DidEnterBackground(func() bool { return r.Intn(2) == 0 })
			case 4:
				c.DidEnterBackground(noStay)
			case 5:
				if r.Intn(10) == 0 {
					c.WillTerminate(noop)
				}
			}
			time.Sleep(time.Duration(r.Intn(50)) * time.Microsecond)
		}
		c.DidBecomeActive()
		close(lifecycleDone)
		waitGroupWithin(t, &owners, "owners deadlocked")
		require.Equal(t, foreground, appState.State())
	}

	t.Run("ends in foreground", func(t *testing.T) {
		chaos(t, 300)
	})

	// Android's process stop and the push service both open a window and
	// start a task; the newest window must close once the tasks are done.
	t.Run("ends in background task", func(t *testing.T) {
		for range 50 {
			chaos(t, 20)
			var tasks sync.WaitGroup
			for range 4 {
				tasks.Add(1)
				go func() {
					defer tasks.Done()
					if c.DidEnterBackground(stay) {
						c.RunBackgroundTask(context.Background(), noDeliveries())
					}
				}()
			}
			waitGroupWithin(t, &tasks, "background tasks deadlocked")
			require.Equal(t, background, appState.State())
		}
	})

	t.Run("ends in background", func(t *testing.T) {
		chaos(t, 300)
		c.DidEnterBackground(noStay)
		require.Equal(t, background, appState.State())
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
