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
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type UIState string

const (
	UIBackground UIState = "background"
	UIInactive   UIState = "inactive"
	UIActive     UIState = "active"
)

// Reason says what a hold keeps running, and so which events end it.
type Reason string

const (
	ReasonBackgroundTask Reason = "backgroundTask"
	ReasonBackgroundSync Reason = "backgroundSync"
	ReasonPushWindow     Reason = "pushWindow"
	ReasonLiveLocation   Reason = "liveLocation"
)

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
	// Flush runs whenever the state changes into BACKGROUND, where the OS may
	// suspend or kill the process next. It runs under the controller's lock,
	// so it must not block.
	Flush func()
	Debug func(format string, args ...interface{})
}

type BackgroundTaskDeps struct {
	// Stay reports whether any work must keep a backgrounded app running. A
	// task asks it at the start and on every poll, off the controller's lock:
	// answering reads the outbox.
	Stay func() bool
	// ActiveDeliveries names the messages still sending when the task runs out
	// of time, for the failure notice.
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
	// done is closed once the hold has ended, by Release or by the controller.
	done chan struct{}
}

// Released reports whether the hold has ended, by Release or by the
// controller. Release cannot stand in for it: on a hold that is still open,
// asking that way would end it.
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
func (h *Hold) Release() bool { return h.c.release(h) }

type Controller struct {
	appState AppState
	cfg      Config
	// ctx ends the background tasks the controller runs; see Close.
	ctx    context.Context
	cancel context.CancelFunc

	// wg counts the background task goroutines Close waits for.
	wg sync.WaitGroup

	// mu serializes every UI report and hold change with the state it writes.
	mu     sync.Mutex
	ui     UIState
	nextID int64
	holds  map[int64]*Hold
	// closed stops new tasks once Close is waiting for the running ones, so
	// nothing joins wg while Close waits on it.
	closed bool
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
	c.ctx, c.cancel = context.WithCancel(context.Background())
	switch appState.State() {
	case keybase1.MobileAppState_FOREGROUND:
		c.ui = UIActive
	case keybase1.MobileAppState_INACTIVE:
		c.ui = UIInactive
	default:
		c.ui = UIBackground
	}
	return c
}

// Close ends the background tasks the controller runs and waits for them to
// return. No task starts after it.
func (c *Controller) Close() {
	c.cancel()
	c.mu.Lock()
	c.closed = true
	c.mu.Unlock()
	c.wg.Wait()
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

func (c *Controller) debugLocked(event string, format string, args ...interface{}) {
	c.cfg.Debug("lifecycle: %s: %s (ui: %v, holds: %d, state: %v)", event, fmt.Sprintf(format, args...),
		c.ui, len(c.holds), c.appState.State())
}

// applyLocked writes the derived state, and flushes when it changes into
// BACKGROUND: the OS may suspend or kill the process from there, and every
// hold that kept it BACKGROUNDACTIVE may have written to the local DBs. A
// flush is a full compaction, so entering BACKGROUNDACTIVE doesn't flush; its
// writes are flushed once the last hold ends.
func (c *Controller) applyLocked() {
	prev := c.appState.State()
	state := derive(c.ui, len(c.holds))
	c.appState.Update(state)
	if state == keybase1.MobileAppState_BACKGROUND && prev != keybase1.MobileAppState_BACKGROUND {
		c.cfg.Flush()
	}
}

func (c *Controller) acquireLocked(reason Reason) *Hold {
	c.nextID++
	h := &Hold{c: c, id: c.nextID, reason: reason, done: make(chan struct{})}
	c.holds[h.id] = h
	return h
}

// dropLocked ends every hold match selects and returns how many it ended.
func (c *Controller) dropLocked(match func(*Hold) bool) (dropped int) {
	for id, h := range c.holds {
		if match(h) {
			delete(c.holds, id)
			close(h.done)
			dropped++
		}
	}
	return dropped
}

// setUILocked records a UI report. Leaving the background ends the holds that
// only keep a backgrounded app alive.
func (c *Controller) setUILocked(ui UIState) {
	if c.ui == UIBackground && ui != UIBackground {
		c.dropLocked(func(h *Hold) bool { return h.reason == ReasonBackgroundTask || h.reason == ReasonBackgroundSync })
	}
	c.ui = ui
}

// runningTaskLocked returns the open background task hold's id, or 0.
func (c *Controller) runningTaskLocked() int64 {
	for id, h := range c.holds {
		if h.reason == ReasonBackgroundTask {
			return id
		}
	}
	return 0
}

// startTaskLocked opens a background task hold and runs the task that keeps
// it until the work is done. A background task hold that is already open is
// reused instead, so one task at a time keeps the app up and warns about
// failures, and a later start doesn't extend its maximum duration.
func (c *Controller) startTaskLocked(deps BackgroundTaskDeps) int64 {
	if c.closed {
		return 0
	}
	if id := c.runningTaskLocked(); id != 0 {
		return id
	}
	h := c.acquireLocked(ReasonBackgroundTask)
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		c.runBackgroundTask(h, deps)
	}()
	return h.id
}

// AcquireBackgroundWork opens a live location hold, which keeps a backgrounded
// app BACKGROUNDACTIVE until it is released. Of the controller's events only
// WillTerminate ends it, which is why it is the one hold callers may open for
// themselves -- and why a caller holding one past a WillTerminate must check
// Released before it counts on it.
func (c *Controller) AcquireBackgroundWork() *Hold {
	c.mu.Lock()
	defer c.mu.Unlock()
	h := c.acquireLocked(ReasonLiveLocation)
	c.applyLocked()
	c.debugLocked("acquire", "%v hold %d", h.reason, h.id)
	return h
}

func (c *Controller) release(h *Hold) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dropLocked(func(o *Hold) bool { return o == h }) == 0 {
		return false
	}
	c.applyLocked()
	c.debugLocked("release", "%v hold %d", h.reason, h.id)
	return true
}

func (c *Controller) UIActive() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.setUILocked(UIActive)
	c.applyLocked()
	c.debugLocked("uiActive", "applied")
}

// UIInactive covers the app on screen without receiving events (Control
// Center, alerts, the app switcher, iPad focus loss) and a scene or process
// coming to the foreground before it is active.
func (c *Controller) UIInactive() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.setUILocked(UIInactive)
	c.applyLocked()
	c.debugLocked("uiInactive", "applied")
}

// UIBackground records the UI leaving the screen and starts a background task,
// which keeps the app BACKGROUNDACTIVE while work must keep going and ends at
// once when none does. It returns the task hold's token for
// WaitBackgroundTask, or 0 once the controller is closed.
//
// A report while the UI is already in the background starts nothing -- a new
// task would take the app through BACKGROUNDACTIVE and back for no reason. It
// returns the running task's token, or 0. Android reports this after a
// finishing activity's willExit, once the process stops.
func (c *Controller) UIBackground(deps BackgroundTaskDeps) int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ui == UIBackground {
		token := c.runningTaskLocked()
		c.debugLocked("uiBackground", "already in the background, background task hold %d", token)
		return token
	}
	c.setUILocked(UIBackground)
	token := c.startTaskLocked(deps)
	c.applyLocked()
	c.debugLocked("uiBackground", "background task hold %d", token)
	return token
}

// WaitBackgroundTask returns once the hold at token has ended, which is what
// native is asking about: whether Go still needs background time. Ids are
// never reused, so no entry means the hold has already ended.
func (c *Controller) WaitBackgroundTask(token int64) {
	c.mu.Lock()
	h := c.holds[token]
	c.mu.Unlock()
	if h == nil {
		return
	}
	<-h.done
	// A hold's done closes under the lock, before the state its end derives is
	// written; taking the lock again waits for that write, so a caller that
	// gives up its background time never leaves a stale state behind.
	c.mu.Lock()
	defer c.mu.Unlock()
	c.debugLocked("waitBackgroundTask", "hold %d ended", token)
}

// WillTerminate ends every hold: the process is about to die. notifyPending
// warns about messages that won't send; it runs last because it can take
// seconds and native waits only briefly.
func (c *Controller) WillTerminate(notifyPending func()) {
	c.mu.Lock()
	c.setUILocked(UIBackground)
	c.dropLocked(func(*Hold) bool { return true })
	c.applyLocked()
	c.debugLocked("willTerminate", "ended every hold")
	c.mu.Unlock()
	notifyPending()
}

// BackgroundTaskExpired ends every background task hold: iOS is ending the
// app's background time, which is per app, so every UIKit task still open
// expires with it. Live location, push window and sync holds keep their own
// lifetimes.
func (c *Controller) BackgroundTaskExpired(notifyPending func()) {
	c.mu.Lock()
	ended := c.dropLocked(func(h *Hold) bool { return h.reason == ReasonBackgroundTask })
	c.applyLocked()
	c.debugLocked("backgroundTaskExpired", "ended %d background task holds", ended)
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
		c.debugLocked("pushWindowBegin", "skipped in the foreground")
		return 0
	}
	h := c.acquireLocked(ReasonPushWindow)
	c.applyLocked()
	c.debugLocked("pushWindowBegin", "hold %d", h.id)
	return h.id
}

// PushWindowEnd ends the push window's hold. If the UI is still in the
// background, it first hands over to a background task, which keeps the app
// up while work must keep going. The token it returns is for the test harness;
// native ignores it.
func (c *Controller) PushWindowEnd(token int64, deps BackgroundTaskDeps) int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	var task int64
	if h, ok := c.holds[token]; ok && h.reason == ReasonPushWindow {
		if c.ui == UIBackground {
			task = c.startTaskLocked(deps)
		}
		c.dropLocked(func(o *Hold) bool { return o == h })
		c.applyLocked()
	}
	c.debugLocked("pushWindowEnd", "hold %d ended, background task hold %d", token, task)
	return task
}

// BackgroundSync holds the app up for the sync window while the UI is in the
// background. It returns a status for native logs.
func (c *Controller) BackgroundSync() string {
	c.mu.Lock()
	if c.ui != UIBackground {
		msg := "skipping, app not in background state: " + c.appState.State().String()
		c.debugLocked("backgroundSyncBegin", "%s", msg)
		c.mu.Unlock()
		return msg
	}
	h := c.acquireLocked(ReasonBackgroundSync)
	c.applyLocked()
	c.debugLocked("backgroundSyncBegin", "hold %d", h.id)
	c.mu.Unlock()
	var msg string
	select {
	case <-h.done:
		msg = "bailing out early, hold ended: " + c.appState.State().String()
	case <-c.cfg.Clock.After(c.cfg.BackgroundSyncWindow):
		msg = "completed window"
	}
	h.Release()
	c.cfg.Debug("lifecycle: backgroundSyncEnd: hold %d: %s", h.id, msg)
	return msg
}

// runBackgroundTask keeps the background task hold h while work must keep
// going: until Stay says nothing does, a message fails, time runs out, the
// hold is ended (the UI left the background, expiration, termination) or the
// controller is closed.
func (c *Controller) runBackgroundTask(h *Hold, deps BackgroundTaskDeps) {
	if !deps.Stay() {
		released := h.Release()
		c.cfg.Debug("lifecycle: backgroundTaskEnd: hold %d done because: nothing to keep running, released: %v",
			h.id, released)
		return
	}
	clock := c.cfg.Clock
	// Round(0) drops the monotonic reading, so time the device spends asleep
	// counts toward the maximum.
	beginTime := clock.Now().Round(0)
	g, ctx := errgroup.WithContext(c.ctx)
	g.Go(func() error {
		select {
		case <-h.done:
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
		// An empty outbox can race a failure, so it takes three polls in a row
		// with nothing to keep running to end the task.
		idlePolls := 0
		for {
			select {
			case <-clock.After(c.cfg.BackgroundTaskPollInterval):
			case <-ctx.Done():
				return ctx.Err()
			}
			if deps.Stay() {
				idlePolls = 0
			} else {
				idlePolls++
				if idlePolls > 2 {
					return errors.New("nothing to keep running")
				}
			}
			if clock.Now().Round(0).Sub(beginTime) >= c.cfg.BackgroundTaskMaxDuration {
				pending, err := deps.ActiveDeliveries(ctx)
				if err != nil {
					c.cfg.Debug("lifecycle: failed to query active deliveries: %s", err)
				}
				deps.NotifyFailure(pending)
				return errors.New("time expired")
			}
		}
	})
	err := g.Wait()
	released := h.Release()
	c.cfg.Debug("lifecycle: backgroundTaskEnd: hold %d done because: %v, released: %v", h.id, err, released)
}
