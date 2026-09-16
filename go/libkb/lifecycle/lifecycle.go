// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package lifecycle turns the mobile app's lifecycle events, as reported by
// native code, into MobileAppState updates. Owners of a transition (background
// sync, background tasks, push windows, live location) undo only their own
// transition, by generation.
//
// It must not import libkb: libkb holds a Controller, and libkb's own tests
// drive it.
package lifecycle

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type Event int

const (
	EventWillEnterForeground Event = iota
	EventDidBecomeActive
	EventWillResignActive
	EventDidEnterBackground
	EventWillTerminate
	EventBackgroundTaskBegin
	EventBackgroundTaskEnd
	EventBackgroundTaskExpired
	EventPushWindowBegin
	EventPushWindowEnd
	EventBackgroundSyncBegin
	EventBackgroundSyncEnd
	EventLiveLocationClaim
	EventLiveLocationRelease
)

var eventNames = map[Event]string{
	EventWillEnterForeground:   "willEnterForeground",
	EventDidBecomeActive:       "didBecomeActive",
	EventWillResignActive:      "willResignActive",
	EventDidEnterBackground:    "didEnterBackground",
	EventWillTerminate:         "willTerminate",
	EventBackgroundTaskBegin:   "backgroundTaskBegin",
	EventBackgroundTaskEnd:     "backgroundTaskEnd",
	EventBackgroundTaskExpired: "backgroundTaskExpired",
	EventPushWindowBegin:       "pushWindowBegin",
	EventPushWindowEnd:         "pushWindowEnd",
	EventBackgroundSyncBegin:   "backgroundSyncBegin",
	EventBackgroundSyncEnd:     "backgroundSyncEnd",
	EventLiveLocationClaim:     "liveLocationClaim",
	EventLiveLocationRelease:   "liveLocationRelease",
}

func (e Event) String() string {
	if name, ok := eventNames[e]; ok {
		return name
	}
	return fmt.Sprintf("Event(%d)", int(e))
}

// AppState is the part of libkb.MobileAppState the controller drives.
type AppState interface {
	State() keybase1.MobileAppState
	StateAndGeneration() (keybase1.MobileAppState, uint64)
	Update(state keybase1.MobileAppState) (changed bool)
	UpdateWithCheck(state keybase1.MobileAppState, check func(keybase1.MobileAppState) bool) (
		newGen uint64, applied bool, changed bool)
	UpdateIfGeneration(gen uint64, state keybase1.MobileAppState) (newGen uint64, applied bool, changed bool)
	NextUpdate(lastState keybase1.MobileAppState) <-chan struct{}
}

const (
	DefaultBackgroundSyncWindow       = 10 * time.Second
	DefaultBackgroundTaskPollInterval = 5 * time.Second
	DefaultBackgroundTaskMaxDuration  = 10 * time.Minute
)

// Config holds the controller's dependencies. Zero fields get defaults: the
// real clock, the default durations, and no-op hooks.
type Config struct {
	Clock                      clockwork.Clock
	BackgroundSyncWindow       time.Duration
	BackgroundTaskPollInterval time.Duration
	BackgroundTaskMaxDuration  time.Duration
	// Flush runs after every real change into BACKGROUND, and into a
	// background task window, where the OS may suspend or kill the process
	// next. It must not block.
	Flush func()
	Debug func(format string, args ...interface{})
}

type Controller struct {
	appState AppState
	cfg      Config
	// taskGen is the generation of the open background task window, 0 when
	// none is open.
	taskGen atomic.Uint64
	// liveLocationGen is the generation of live location's claim, 0 when it
	// holds none.
	liveLocationGen atomic.Uint64
	// testHookAfterWindowUpdate runs between opening a window and recording
	// its generation.
	testHookAfterWindowUpdate func()
}

func New(appState AppState, cfg Config) *Controller {
	if cfg.Clock == nil {
		cfg.Clock = clockwork.NewRealClock()
	}
	if cfg.BackgroundSyncWindow == 0 {
		cfg.BackgroundSyncWindow = DefaultBackgroundSyncWindow
	}
	if cfg.BackgroundTaskPollInterval == 0 {
		cfg.BackgroundTaskPollInterval = DefaultBackgroundTaskPollInterval
	}
	if cfg.BackgroundTaskMaxDuration == 0 {
		cfg.BackgroundTaskMaxDuration = DefaultBackgroundTaskMaxDuration
	}
	if cfg.Flush == nil {
		cfg.Flush = func() {}
	}
	if cfg.Debug == nil {
		cfg.Debug = func(string, ...interface{}) {}
	}
	return &Controller{appState: appState, cfg: cfg}
}

func (c *Controller) debug(ev Event, format string, args ...interface{}) {
	state, gen := c.appState.StateAndGeneration()
	c.cfg.Debug("lifecycle: %v: %s (state: %v, generation: %d)", ev, fmt.Sprintf(format, args...), state, gen)
}

func (c *Controller) update(state keybase1.MobileAppState) {
	if c.appState.Update(state) && state == keybase1.MobileAppState_BACKGROUND {
		c.cfg.Flush()
	}
}

// recordGen raises owner to gen. Opening a window and recording it are
// separate steps, so concurrent openers can record out of order; only raising
// keeps the newest window recorded.
func (c *Controller) recordGen(owner *atomic.Uint64, gen uint64) {
	if c.testHookAfterWindowUpdate != nil {
		c.testHookAfterWindowUpdate()
	}
	for {
		cur := owner.Load()
		if cur >= gen || owner.CompareAndSwap(cur, gen) {
			return
		}
	}
}

// undoToBackground returns to BACKGROUND only if nothing has updated the app
// state since the owner's own transition at gen.
func (c *Controller) undoToBackground(gen uint64) (applied bool) {
	if gen == 0 {
		return false
	}
	_, applied, changed := c.appState.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUND)
	if changed {
		c.cfg.Flush()
	}
	return applied
}

func always(keybase1.MobileAppState) bool { return true }

func isState(want keybase1.MobileAppState) func(keybase1.MobileAppState) bool {
	return func(s keybase1.MobileAppState) bool { return s == want }
}

// WillEnterForeground brings networking up before the UI resumes, without
// claiming the user is looking at the app yet.
func (c *Controller) WillEnterForeground() {
	c.update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	c.debug(EventWillEnterForeground, "applied")
}

func (c *Controller) DidBecomeActive() {
	c.update(keybase1.MobileAppState_FOREGROUND)
	c.debug(EventDidBecomeActive, "applied")
}

// WillResignActive covers the app being on screen without receiving events:
// Control Center, system alerts, the app switcher, iPad focus loss.
func (c *Controller) WillResignActive() {
	c.update(keybase1.MobileAppState_INACTIVE)
	c.debug(EventWillResignActive, "applied")
}

// DidEnterBackground moves to BACKGROUND, or, when stayRunning says work must
// keep going, opens a BACKGROUNDACTIVE window for a background task and
// returns true.
func (c *Controller) DidEnterBackground(stayRunning func() bool) bool {
	if !stayRunning() {
		c.taskGen.Store(0)
		c.update(keybase1.MobileAppState_BACKGROUND)
		c.debug(EventDidEnterBackground, "no work to keep running")
		return false
	}
	gen, _, changed := c.appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE, always)
	c.recordGen(&c.taskGen, gen)
	// The OS may still suspend or kill us once the background task runs out.
	if changed {
		c.cfg.Flush()
	}
	c.debug(EventDidEnterBackground, "opened background task window at %d", gen)
	return true
}

// WillTerminate forces BACKGROUND regardless of owners: the process is about
// to die. notifyPending warns about messages that won't send. It runs last:
// it can take seconds (an outbox query and a local notification), and native
// only waits briefly before the process exits, so the state change and the
// flush must not wait behind it.
func (c *Controller) WillTerminate(notifyPending func()) {
	c.taskGen.Store(0)
	c.update(keybase1.MobileAppState_BACKGROUND)
	notifyPending()
	c.debug(EventWillTerminate, "applied")
}

// BackgroundTaskExpired ends the background task window without clobbering a
// state reported after the window opened, such as a return to the foreground.
// notifyPending runs only when the window was still open, since otherwise we
// aren't about to be suspended.
func (c *Controller) BackgroundTaskExpired(notifyPending func()) {
	gen := c.taskGen.Swap(0)
	applied := c.undoToBackground(gen)
	if applied {
		notifyPending()
	}
	c.debug(EventBackgroundTaskExpired, "window %d closed: %v", gen, applied)
}

// PushWindowBegin moves to BACKGROUNDACTIVE while a push is handled, unless
// the app is in the foreground. It returns the token for PushWindowEnd, or 0
// if the app is in the foreground.
func (c *Controller) PushWindowBegin() int64 {
	gen, applied, _ := c.appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		func(s keybase1.MobileAppState) bool { return s != keybase1.MobileAppState_FOREGROUND })
	if !applied {
		c.debug(EventPushWindowBegin, "skipped in the foreground")
		return 0
	}
	c.debug(EventPushWindowBegin, "opened at %d", gen)
	return int64(gen)
}

// PushWindowEnd closes the window opened at token, only if nothing has updated
// the app state since. It returns true when it hands the window over to a
// background task (as DidEnterBackground does), and false when it moved to
// BACKGROUND or someone else owns the state now.
func (c *Controller) PushWindowEnd(token int64, stayRunning func() bool) bool {
	if token <= 0 {
		return false
	}
	gen := uint64(token)
	if _, cur := c.appState.StateAndGeneration(); cur != gen {
		c.debug(EventPushWindowEnd, "window %d superseded", gen)
		return false
	}
	if stayRunning() {
		newGen, applied, _ := c.appState.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUNDACTIVE)
		if !applied {
			c.debug(EventPushWindowEnd, "window %d superseded", gen)
			return false
		}
		c.recordGen(&c.taskGen, newGen)
		c.debug(EventPushWindowEnd, "window %d handed to background task at %d", gen, newGen)
		return true
	}
	applied := c.undoToBackground(gen)
	c.debug(EventPushWindowEnd, "window %d closed: %v", gen, applied)
	return false
}

// BackgroundSync moves BACKGROUND to BACKGROUNDACTIVE for the sync window,
// then undoes that transition unless someone else updated the state meanwhile.
// It returns a status for native logs.
func (c *Controller) BackgroundSync() string {
	gen, applied, _ := c.appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		isState(keybase1.MobileAppState_BACKGROUND))
	if !applied {
		msg := "skipping, app not in background state: " + c.appState.State().String()
		c.debug(EventBackgroundSyncBegin, "%s", msg)
		return msg
	}
	c.debug(EventBackgroundSyncBegin, "opened at %d", gen)
	timer := c.cfg.Clock.After(c.cfg.BackgroundSyncWindow)
	var msg string
	select {
	case <-c.appState.NextUpdate(keybase1.MobileAppState_BACKGROUNDACTIVE):
		msg = "bailing out early, appstate change: " + c.appState.State().String()
	case <-timer:
		if c.undoToBackground(gen) {
			msg = "completed window"
		} else {
			msg = "completed window, app state updated meanwhile: " + c.appState.State().String()
		}
	}
	c.debug(EventBackgroundSyncEnd, "%s", msg)
	return msg
}

// LiveLocationClaim moves BACKGROUND to BACKGROUNDACTIVE while live location
// is tracking, so location updates get out.
func (c *Controller) LiveLocationClaim() {
	gen, applied, _ := c.appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		isState(keybase1.MobileAppState_BACKGROUND))
	if !applied {
		return
	}
	c.recordGen(&c.liveLocationGen, gen)
	c.debug(EventLiveLocationClaim, "claimed at %d", gen)
}

// LiveLocationRelease returns to BACKGROUND, flushing like every other return
// to BACKGROUND, only if nothing has updated the app state since the claim.
func (c *Controller) LiveLocationRelease() {
	gen := c.liveLocationGen.Swap(0)
	if gen == 0 {
		return
	}
	applied := c.undoToBackground(gen)
	c.debug(EventLiveLocationRelease, "claim %d released: %v", gen, applied)
}

type BackgroundTaskDeps struct {
	ActiveDeliveries func(context.Context) ([]chat1.OutboxRecord, error)
	NextFailure      func() (chan []chat1.OutboxRecord, func())
	NotifyFailure    func([]chat1.OutboxRecord)
}

// RunBackgroundTask waits while the background task window opened by
// DidEnterBackground or PushWindowEnd is still current, until outgoing
// messages are delivered, one fails, time runs out or ctx is done; then it
// returns to BACKGROUND unless someone else has updated the app state since
// the window opened.
func (c *Controller) RunBackgroundTask(ctx context.Context, deps BackgroundTaskDeps) {
	gen := c.taskGen.Load()
	state, cur := c.appState.StateAndGeneration()
	if state != keybase1.MobileAppState_BACKGROUNDACTIVE || gen == 0 || cur != gen {
		c.debug(EventBackgroundTaskBegin, "no background task window, early out")
		return
	}
	c.debug(EventBackgroundTaskBegin, "window %d", gen)
	clock := c.cfg.Clock
	// Round(0) drops the monotonic reading, so time the device spends asleep
	// counts toward the maximum.
	beginTime := clock.Now().Round(0)
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		select {
		case <-c.appState.NextUpdate(state):
			return errors.New("app state change")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		ch, cancel := deps.NextFailure()
		defer cancel()
		select {
		case obrs := <-ch:
			deps.NotifyFailure(obrs)
			return fmt.Errorf("failure received: %d marked", len(obrs))
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		successCount := 0
		for {
			select {
			case <-clock.After(c.cfg.BackgroundTaskPollInterval):
				obrs, err := deps.ActiveDeliveries(ctx)
				if err != nil {
					c.cfg.Debug("lifecycle: failed to query active deliveries: %s", err)
					continue
				}
				if len(obrs) == 0 {
					// We can race the failure case here, so lets go a couple passes of no pending
					// convs before we abort due to ths condition.
					if successCount > 1 {
						return errors.New("delivered everything")
					}
					successCount++
				}
				if clock.Now().Round(0).Sub(beginTime) >= c.cfg.BackgroundTaskMaxDuration {
					deps.NotifyFailure(obrs)
					return errors.New("time expired")
				}
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	})
	err := g.Wait()
	// A matching CAS also clears the window, so a later expiration is a no-op.
	closed := c.taskGen.CompareAndSwap(gen, 0) && c.undoToBackground(gen)
	c.debug(EventBackgroundTaskEnd, "window %d done because: %v, closed: %v", gen, err, closed)
}
