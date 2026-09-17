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
	"maps"
	"slices"
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
	ReasonLaunch         Reason = "launch"
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
	// Flush runs when the state moves into BACKGROUNDACTIVE or BACKGROUND from
	// anything but BACKGROUND, where the OS may suspend or kill the process
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
	// done is closed once the hold has ended, by Release or by the controller.
	done chan struct{}
}

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

	// mu serializes every UI report and hold change with the state it writes.
	mu     sync.Mutex
	ui     UIState
	nextID int64
	holds  map[int64]*Hold
	// tasks maps each running background task's hold id to a channel closed
	// when its goroutine returns.
	tasks map[int64]chan struct{}
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
	c := &Controller{appState: appState, cfg: cfg, holds: make(map[int64]*Hold), tasks: make(map[int64]chan struct{})}
	c.ctx, c.cancel = context.WithCancel(context.Background())
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

// Close ends the background tasks the controller runs and waits for them to
// return. Tasks started later end at once.
func (c *Controller) Close() {
	c.cancel()
	c.mu.Lock()
	tasks := slices.Collect(maps.Values(c.tasks))
	c.mu.Unlock()
	for _, done := range tasks {
		<-done
	}
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

// applyLocked writes the derived state. The OS may suspend or kill the
// process once the UI is in the background or nothing holds it up, so it
// flushes when the state moves into the background from anything but
// BACKGROUND.
func (c *Controller) applyLocked() {
	prev := c.appState.State()
	state := derive(c.ui, len(c.holds))
	if c.appState.Update(state) && prev != keybase1.MobileAppState_BACKGROUND &&
		(state == keybase1.MobileAppState_BACKGROUND || state == keybase1.MobileAppState_BACKGROUNDACTIVE) {
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

// setUILocked records a UI report. Any report ends the launch hold; leaving
// the background ends the holds that only keep a backgrounded app alive.
func (c *Controller) setUILocked(ui UIState) {
	c.dropLocked(func(h *Hold) bool { return h.reason == ReasonLaunch })
	if c.ui == UIBackground && ui != UIBackground {
		c.dropLocked(func(h *Hold) bool { return h.reason == ReasonBackgroundTask || h.reason == ReasonBackgroundSync })
	}
	c.ui = ui
}

// startTaskLocked opens a background task hold and runs the task that keeps
// it until the work is done.
func (c *Controller) startTaskLocked(deps BackgroundTaskDeps) int64 {
	h := c.acquireLocked(ReasonBackgroundTask)
	done := make(chan struct{})
	c.tasks[h.id] = done
	go func() {
		c.runBackgroundTask(h, deps)
		c.mu.Lock()
		delete(c.tasks, h.id)
		c.mu.Unlock()
		close(done)
	}()
	return h.id
}

// AcquireBackgroundWork opens a hold that keeps a backgrounded app
// BACKGROUNDACTIVE until it is released.
func (c *Controller) AcquireBackgroundWork(reason Reason) *Hold {
	c.mu.Lock()
	defer c.mu.Unlock()
	h := c.acquireLocked(reason)
	c.applyLocked()
	c.debugLocked("acquire", "%v hold %d", reason, h.id)
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

// UIBackground records the UI leaving the screen. When stay says work must
// keep going it starts a background task and returns its hold's token for
// WaitBackgroundTask; otherwise it returns 0.
func (c *Controller) UIBackground(stay bool, deps BackgroundTaskDeps) int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.setUILocked(UIBackground)
	var token int64
	if stay {
		token = c.startTaskLocked(deps)
	}
	c.applyLocked()
	c.debugLocked("uiBackground", "background task hold %d", token)
	return token
}

// WaitBackgroundTask returns once the background task at token has returned.
func (c *Controller) WaitBackgroundTask(token int64) {
	c.mu.Lock()
	done, ok := c.tasks[token]
	c.mu.Unlock()
	if ok {
		<-done
	}
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
// app's background time. Native drops stale expirations, so these are the
// current entry's holds and any older ones still running. Live location,
// push window and sync holds keep their own lifetimes.
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
// background and stay says work must keep going, it first starts a background
// task and returns its hold's token.
func (c *Controller) PushWindowEnd(token int64, stay bool, deps BackgroundTaskDeps) int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	var task int64
	if h, ok := c.holds[token]; ok && h.reason == ReasonPushWindow {
		if stay && c.ui == UIBackground {
			task = c.startTaskLocked(deps)
		}
		c.dropLocked(func(o *Hold) bool { return o == h })
	}
	c.applyLocked()
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

// runBackgroundTask keeps the background task hold h until outgoing messages
// are delivered, one fails, time runs out, the hold is ended (the UI left the
// background, expiration, termination) or the controller is closed.
func (c *Controller) runBackgroundTask(h *Hold, deps BackgroundTaskDeps) {
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
	c.cfg.Debug("lifecycle: backgroundTaskEnd: hold %d done because: %v, released: %v", h.id, err, released)
}
