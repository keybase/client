// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package lifecycle derives the mobile app's MobileAppState from the UI state
// native code reports and the background work that must keep running:
// FOREGROUND and INACTIVE follow the UI, and a background UI is
// BACKGROUNDACTIVE while any hold is open and BACKGROUND otherwise.
//
// It must not import libkb: libkb holds a Controller, and libkb's own tests
// drive it.
package lifecycle

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type UIState int

const (
	UIBackground UIState = iota
	UIInactive
	UIActive
)

func (s UIState) String() string {
	switch s {
	case UIBackground:
		return "background"
	case UIInactive:
		return "inactive"
	case UIActive:
		return "active"
	default:
		return fmt.Sprintf("UIState(%d)", int(s))
	}
}

// Reason says what a hold keeps running, and so which events end it.
type Reason int

const (
	ReasonLaunch Reason = iota + 1
	ReasonBackgroundTask
	ReasonBackgroundSync
	ReasonPushWindow
	ReasonLiveLocation
)

var reasonNames = map[Reason]string{
	ReasonLaunch:         "launch",
	ReasonBackgroundTask: "backgroundTask",
	ReasonBackgroundSync: "backgroundSync",
	ReasonPushWindow:     "pushWindow",
	ReasonLiveLocation:   "liveLocation",
}

func (r Reason) String() string {
	if name, ok := reasonNames[r]; ok {
		return name
	}
	return fmt.Sprintf("Reason(%d)", int(r))
}

type Event int

const (
	EventUIActive Event = iota
	EventUIInactive
	EventUIBackground
	EventWillTerminate
	EventBackgroundTaskExpired
	EventBackgroundTaskBegin
	EventBackgroundTaskEnd
	EventPushWindowBegin
	EventPushWindowEnd
	EventBackgroundSyncBegin
	EventBackgroundSyncEnd
	EventAcquire
	EventRelease
)

var eventNames = map[Event]string{
	EventUIActive:              "uiActive",
	EventUIInactive:            "uiInactive",
	EventUIBackground:          "uiBackground",
	EventWillTerminate:         "willTerminate",
	EventBackgroundTaskExpired: "backgroundTaskExpired",
	EventBackgroundTaskBegin:   "backgroundTaskBegin",
	EventBackgroundTaskEnd:     "backgroundTaskEnd",
	EventPushWindowBegin:       "pushWindowBegin",
	EventPushWindowEnd:         "pushWindowEnd",
	EventBackgroundSyncBegin:   "backgroundSyncBegin",
	EventBackgroundSyncEnd:     "backgroundSyncEnd",
	EventAcquire:               "acquire",
	EventRelease:               "release",
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
	Update(state keybase1.MobileAppState) (changed bool)
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
	// Flush runs when the UI enters the background and when the state
	// changes into BACKGROUND, where the OS may suspend or kill the process
	// next. It runs at most once per controller call, under the controller's
	// lock, so it must not block.
	Flush func()
	Debug func(format string, args ...interface{})
}

type BackgroundTaskDeps struct {
	ActiveDeliveries func(context.Context) ([]chat1.OutboxRecord, error)
	NextFailure      func() (chan []chat1.OutboxRecord, func())
	NotifyFailure    func([]chat1.OutboxRecord)
}

// Hold keeps a backgrounded app BACKGROUNDACTIVE until it is released or the
// controller ends it.
type Hold struct {
	c      *Controller
	id     int64
	reason Reason
	done   chan struct{}
}

func (h *Hold) ID() int64 { return h.id }

// Done is closed once the hold has ended, by Release or by the controller.
func (h *Hold) Done() <-chan struct{} { return h.done }

func (h *Hold) Released() bool {
	select {
	case <-h.done:
		return true
	default:
		return false
	}
}

// Release ends the hold. It reports whether this call ended it; ending a hold
// again, or one the controller already ended, does nothing.
func (h *Hold) Release() bool { return h.c.release(h.id) }

type Controller struct {
	appState AppState
	cfg      Config

	// mu serializes every UI report and hold change with the state it writes.
	mu     sync.Mutex
	ui     UIState
	nextID int64
	holds  map[int64]*Hold
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
	c := &Controller{appState: appState, cfg: cfg, holds: make(map[int64]*Hold)}
	switch appState.State() {
	case keybase1.MobileAppState_FOREGROUND:
		c.ui = UIActive
	case keybase1.MobileAppState_INACTIVE:
		c.ui = UIInactive
	case keybase1.MobileAppState_BACKGROUNDACTIVE:
		// Android starts its process up; the first UI report ends this.
		c.ui = UIBackground
		c.acquireLocked(ReasonLaunch)
	default:
		c.ui = UIBackground
	}
	return c
}

func derive(ui UIState, holds int) keybase1.MobileAppState {
	switch {
	case ui == UIActive:
		return keybase1.MobileAppState_FOREGROUND
	case ui == UIInactive:
		return keybase1.MobileAppState_INACTIVE
	case holds > 0:
		return keybase1.MobileAppState_BACKGROUNDACTIVE
	default:
		return keybase1.MobileAppState_BACKGROUND
	}
}

func (c *Controller) debugLocked(ev Event, format string, args ...interface{}) {
	c.cfg.Debug("lifecycle: %v: %s (ui: %v, holds: %d, state: %v)", ev, fmt.Sprintf(format, args...),
		c.ui, len(c.holds), c.appState.State())
}

// applyLocked writes the derived state. The OS may suspend or kill the
// process once the UI is in the background or nothing holds it up, so it
// flushes when the UI just entered the background or the state just changed
// into BACKGROUND.
func (c *Controller) applyLocked(uiEnteredBackground bool) {
	state := derive(c.ui, len(c.holds))
	changed := c.appState.Update(state)
	if uiEnteredBackground || (changed && state == keybase1.MobileAppState_BACKGROUND) {
		c.cfg.Flush()
	}
}

func (c *Controller) acquireLocked(reason Reason) *Hold {
	c.nextID++
	h := &Hold{c: c, id: c.nextID, reason: reason, done: make(chan struct{})}
	c.holds[h.id] = h
	return h
}

func (c *Controller) dropLocked(id int64) bool {
	h, ok := c.holds[id]
	if !ok {
		return false
	}
	delete(c.holds, id)
	close(h.done)
	return true
}

func (c *Controller) dropReasonsLocked(reasons ...Reason) (dropped int) {
	for id, h := range c.holds {
		if slices.Contains(reasons, h.reason) && c.dropLocked(id) {
			dropped++
		}
	}
	return dropped
}

// setUILocked records a UI report. Any report ends the launch hold; leaving
// the background ends the holds that only keep a backgrounded app alive.
func (c *Controller) setUILocked(ui UIState) (enteredBackground bool) {
	c.dropReasonsLocked(ReasonLaunch)
	prev := c.ui
	c.ui = ui
	if prev == UIBackground && ui != UIBackground {
		c.dropReasonsLocked(ReasonBackgroundTask, ReasonBackgroundSync)
	}
	return prev != UIBackground && ui == UIBackground
}

// AcquireBackgroundWork opens a hold that keeps a backgrounded app
// BACKGROUNDACTIVE until it is released.
func (c *Controller) AcquireBackgroundWork(reason Reason) *Hold {
	c.mu.Lock()
	defer c.mu.Unlock()
	h := c.acquireLocked(reason)
	c.applyLocked(false)
	c.debugLocked(EventAcquire, "%v hold %d", reason, h.id)
	return h
}

func (c *Controller) release(id int64) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	h, ok := c.holds[id]
	if !ok {
		return false
	}
	c.dropLocked(id)
	c.applyLocked(false)
	c.debugLocked(EventRelease, "%v hold %d", h.reason, id)
	return true
}

func (c *Controller) UIActive() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.applyLocked(c.setUILocked(UIActive))
	c.debugLocked(EventUIActive, "applied")
}

// UIInactive covers the app on screen without receiving events (Control
// Center, alerts, the app switcher, iPad focus loss) and a scene or process
// coming to the foreground before it is active.
func (c *Controller) UIInactive() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.applyLocked(c.setUILocked(UIInactive))
	c.debugLocked(EventUIInactive, "applied")
}

// UIBackground records the UI leaving the screen. When stayRunning says work
// must keep going it opens a background task hold and returns its token for
// RunBackgroundTask; otherwise it returns 0.
func (c *Controller) UIBackground(stayRunning func() bool) int64 {
	// stayRunning takes other locks (the live location tracker's, which is held
	// while calling into the controller), so it must run outside c.mu.
	stay := stayRunning()
	c.mu.Lock()
	defer c.mu.Unlock()
	entered := c.setUILocked(UIBackground)
	var token int64
	if stay {
		token = c.acquireLocked(ReasonBackgroundTask).id
	}
	c.applyLocked(entered)
	c.debugLocked(EventUIBackground, "background task hold %d", token)
	return token
}

// WillTerminate ends every hold: the process is about to die. notifyPending
// warns about messages that won't send; it runs last because it can take
// seconds and native waits only briefly.
func (c *Controller) WillTerminate(notifyPending func()) {
	c.mu.Lock()
	entered := c.setUILocked(UIBackground)
	for id := range c.holds {
		c.dropLocked(id)
	}
	c.applyLocked(entered)
	c.debugLocked(EventWillTerminate, "ended every hold")
	c.mu.Unlock()
	notifyPending()
}

// BackgroundTaskExpired ends every background task hold: iOS is ending the
// app's background time. Native drops stale expirations, so these are the
// current entry's holds and any older ones still running. Live location,
// push window and sync holds keep their own lifetimes.
func (c *Controller) BackgroundTaskExpired(notifyPending func()) {
	c.mu.Lock()
	ended := c.dropReasonsLocked(ReasonBackgroundTask)
	c.applyLocked(false)
	c.debugLocked(EventBackgroundTaskExpired, "ended %d background task holds", ended)
	c.mu.Unlock()
	if ended > 0 {
		notifyPending()
	}
}

// PushWindowBegin holds the app up while a push is handled. It returns the
// hold's token, or 0 when the app is active and nothing needs holding.
func (c *Controller) PushWindowBegin() int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ui == UIActive {
		c.debugLocked(EventPushWindowBegin, "skipped in the foreground")
		return 0
	}
	h := c.acquireLocked(ReasonPushWindow)
	c.applyLocked(false)
	c.debugLocked(EventPushWindowBegin, "hold %d", h.id)
	return h.id
}

// PushWindowEnd ends the push window's hold. If the UI is still in the
// background and work must keep going, it first opens a background task hold
// and returns its token.
func (c *Controller) PushWindowEnd(token int64, stayRunning func() bool) int64 {
	if token <= 0 {
		return 0
	}
	c.mu.Lock()
	h, ok := c.holds[token]
	query := ok && h.reason == ReasonPushWindow && c.ui == UIBackground
	c.mu.Unlock()
	// Outside c.mu, as in UIBackground: stayRunning takes locks held while calling into the controller.
	stay := query && stayRunning()
	c.mu.Lock()
	defer c.mu.Unlock()
	var task int64
	if stay && c.ui == UIBackground {
		task = c.acquireLocked(ReasonBackgroundTask).id
	}
	if h, ok := c.holds[token]; ok && h.reason == ReasonPushWindow {
		c.dropLocked(token)
	}
	c.applyLocked(false)
	c.debugLocked(EventPushWindowEnd, "hold %d ended, background task hold %d", token, task)
	return task
}

// BackgroundSync holds the app up for the sync window while the UI is in the
// background. It returns a status for native logs.
func (c *Controller) BackgroundSync() string {
	c.mu.Lock()
	if c.ui != UIBackground {
		msg := "skipping, app not in background state: " + c.appState.State().String()
		c.debugLocked(EventBackgroundSyncBegin, "%s", msg)
		c.mu.Unlock()
		return msg
	}
	h := c.acquireLocked(ReasonBackgroundSync)
	c.applyLocked(false)
	c.debugLocked(EventBackgroundSyncBegin, "hold %d", h.id)
	c.mu.Unlock()
	var msg string
	select {
	case <-h.Done():
		msg = "bailing out early, hold ended: " + c.appState.State().String()
	case <-c.cfg.Clock.After(c.cfg.BackgroundSyncWindow):
		msg = "completed window"
	}
	h.Release()
	c.mu.Lock()
	c.debugLocked(EventBackgroundSyncEnd, "%s", msg)
	c.mu.Unlock()
	return msg
}

// RunBackgroundTask keeps the background task hold at token until outgoing
// messages are delivered, one fails, time runs out, the hold is ended (the UI
// left the background, expiration, termination) or ctx is done.
func (c *Controller) RunBackgroundTask(ctx context.Context, token int64, deps BackgroundTaskDeps) {
	c.mu.Lock()
	// Task holds exist only while the UI is in the background: leaving it ends them.
	h, ok := c.holds[token]
	if !ok || h.reason != ReasonBackgroundTask {
		c.debugLocked(EventBackgroundTaskBegin, "hold %d not open, early out", token)
		c.mu.Unlock()
		return
	}
	c.debugLocked(EventBackgroundTaskBegin, "hold %d", token)
	c.mu.Unlock()
	clock := c.cfg.Clock
	// Round(0) drops the monotonic reading, so time the device spends asleep
	// counts toward the maximum.
	beginTime := clock.Now().Round(0)
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		select {
		case <-h.Done():
			return errors.New("hold ended")
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
	released := h.Release()
	c.mu.Lock()
	c.debugLocked(EventBackgroundTaskEnd, "hold %d done because: %v, released: %v", token, err, released)
	c.mu.Unlock()
}
