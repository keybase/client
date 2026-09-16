// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

const (
	backgroundSyncWindowDuration = 10 * time.Second
	backgroundTaskPollInterval   = 5 * time.Second
	backgroundTaskMaxDuration    = 10 * time.Minute
)

// backgroundTaskGen is the generation at which the app entered the
// BACKGROUNDACTIVE window that a background task (AppBeginBackgroundTask)
// works under; 0 when no window is open.
var backgroundTaskGen atomic.Uint64

// testHookAfterWindowUpdate runs between opening a background task window and
// recording its generation.
var testHookAfterWindowUpdate func()

// recordWindowGen raises taskGen to gen. Opening a window and recording it are
// separate steps, so concurrent openers can record out of order; only raising
// keeps the newest window recorded.
func recordWindowGen(taskGen *atomic.Uint64, gen uint64) {
	if testHookAfterWindowUpdate != nil {
		testHookAfterWindowUpdate()
	}
	for {
		cur := taskGen.Load()
		if cur >= gen || taskGen.CompareAndSwap(cur, gen) {
			return
		}
	}
}

func isState(want keybase1.MobileAppState) func(keybase1.MobileAppState) bool {
	return func(s keybase1.MobileAppState) bool { return s == want }
}

// undoToBackground returns to BACKGROUND only if nothing has updated the
// app state since the owner's own transition at gen.
func undoToBackground(appState *libkb.MobileAppState, gen uint64, flush func()) (applied bool) {
	if gen == 0 {
		return false
	}
	_, applied, changed := appState.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUND)
	if changed {
		flush()
	}
	return applied
}

// runBackgroundSyncWindow moves BACKGROUND to BACKGROUNDACTIVE for window,
// then undoes that transition unless someone else updated the state meanwhile.
func runBackgroundSyncWindow(appState *libkb.MobileAppState, window time.Duration, flush func()) string {
	gen, applied, _ := appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		isState(keybase1.MobileAppState_BACKGROUND))
	if !applied {
		return "skipping, app not in background state: " + appState.State().String()
	}
	timer := time.NewTimer(window)
	defer timer.Stop()
	select {
	case <-appState.NextUpdate(keybase1.MobileAppState_BACKGROUNDACTIVE):
		return "bailing out early, appstate change: " + appState.State().String()
	case <-timer.C:
		if !undoToBackground(appState, gen, flush) {
			return "completed window, app state updated meanwhile: " + appState.State().String()
		}
		return "completed window"
	}
}

// enterBackground applies the app's move to the background. When the app
// needs to keep running, it opens a BACKGROUNDACTIVE window for a background
// task and returns true; otherwise it moves to BACKGROUND.
func enterBackground(appState *libkb.MobileAppState, stayRunning bool, taskGen *atomic.Uint64, flush func()) bool {
	if !stayRunning {
		taskGen.Store(0)
		updateAppStateAndFlush(appState, keybase1.MobileAppState_BACKGROUND, flush)
		return false
	}
	gen, _, changed := appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		func(keybase1.MobileAppState) bool { return true })
	recordWindowGen(taskGen, gen)
	if changed {
		flush()
	}
	return true
}

// beginPushWindow moves to BACKGROUNDACTIVE unless the app is in the
// foreground, and returns the generation of that transition, or 0 if the app
// is in the foreground.
func beginPushWindow(appState *libkb.MobileAppState) int64 {
	gen, applied, _ := appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		func(s keybase1.MobileAppState) bool { return s != keybase1.MobileAppState_FOREGROUND })
	if !applied {
		return 0
	}
	return int64(gen)
}

// endPushWindow closes the window opened at token, only if nothing has updated
// the app state since. It returns true when it hands the window over to a
// background task (as enterBackground does), and false when it moved to
// BACKGROUND or someone else owns the state now.
func endPushWindow(appState *libkb.MobileAppState, token int64, stayRunning func() bool,
	taskGen *atomic.Uint64, flush func(),
) bool {
	if token <= 0 {
		return false
	}
	gen := uint64(token)
	if _, cur := appState.StateAndGeneration(); cur != gen {
		return false
	}
	if stayRunning() {
		newGen, applied, _ := appState.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUNDACTIVE)
		if !applied {
			return false
		}
		recordWindowGen(taskGen, newGen)
		return true
	}
	undoToBackground(appState, gen, flush)
	return false
}

// expireBackgroundTask ends the background task window without clobbering a
// state reported after the window opened, such as a return to the foreground.
// notifyPending runs only when the window was still open, since otherwise we
// aren't about to be suspended.
func expireBackgroundTask(appState *libkb.MobileAppState, taskGen *atomic.Uint64, flush func(),
	notifyPending func(),
) {
	if undoToBackground(appState, taskGen.Swap(0), flush) {
		notifyPending()
	}
}

type backgroundTaskDeps struct {
	activeDeliveries func(context.Context) ([]chat1.OutboxRecord, error)
	nextFailure      func() (chan []chat1.OutboxRecord, func())
	notifyFailure    func([]chat1.OutboxRecord)
	debug            func(format string, args ...interface{})
	pollInterval     time.Duration
	maxDuration      time.Duration
}

// runBackgroundTask waits while the background task window opened by
// enterBackground is still current, until outgoing messages are delivered,
// one fails, or time runs out; then it returns to BACKGROUND unless someone
// else has updated the app state since the window opened.
func runBackgroundTask(ctx context.Context, appState *libkb.MobileAppState, taskGen *atomic.Uint64,
	deps backgroundTaskDeps, flush func(),
) {
	gen := taskGen.Load()
	state, cur := appState.StateAndGeneration()
	if state != keybase1.MobileAppState_BACKGROUNDACTIVE || gen == 0 || cur != gen {
		deps.debug("AppBeginBackgroundTask: no background task window, early out: state: %v", state)
		return
	}
	beginTime := libkb.ForceWallClock(time.Now())
	ticker := time.NewTicker(deps.pollInterval)
	defer ticker.Stop()
	var g *errgroup.Group
	g, ctx = errgroup.WithContext(ctx)
	g.Go(func() error {
		select {
		case <-appState.NextUpdate(state):
			deps.debug("AppBeginBackgroundTask: app state change, aborting: %v", appState.State())
			return errors.New("app state change")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		ch, cancel := deps.nextFailure()
		defer cancel()
		select {
		case obrs := <-ch:
			deps.debug("AppBeginBackgroundTask: failure received, alerting the user: %d marked", len(obrs))
			deps.notifyFailure(obrs)
			return errors.New("failure received")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		successCount := 0
		for {
			select {
			case <-ticker.C:
				obrs, err := deps.activeDeliveries(ctx)
				if err != nil {
					deps.debug("AppBeginBackgroundTask: failed to query active deliveries: %s", err)
					continue
				}
				if len(obrs) == 0 {
					deps.debug("AppBeginBackgroundTask: delivered everything: successCount: %d", successCount)
					// We can race the failure case here, so lets go a couple passes of no pending
					// convs before we abort due to ths condition.
					if successCount > 1 {
						return errors.New("delivered everything")
					}
					successCount++
				}
				curTime := libkb.ForceWallClock(time.Now())
				if curTime.Sub(beginTime) >= deps.maxDuration {
					deps.debug("AppBeginBackgroundTask: failed to deliver and time is up, aborting")
					deps.notifyFailure(obrs)
					return errors.New("time expired")
				}
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	})
	if err := g.Wait(); err != nil {
		deps.debug("AppBeginBackgroundTask: dropped out of wait because: %s", err)
	}
	// A matching CAS also clears the window, so a later expiration is a no-op.
	if taskGen.CompareAndSwap(gen, 0) {
		undoToBackground(appState, gen, flush)
	}
}
