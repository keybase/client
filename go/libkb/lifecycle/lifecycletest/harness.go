// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycletest

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb/lifecycle"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type Platform int

const (
	IOS Platform = iota
	Android
)

func (p Platform) String() string {
	if p == Android {
		return "android"
	}
	return "ios"
}

// InitialState is the state the service starts in on both platforms.
const InitialState = keybase1.MobileAppState_BACKGROUND

type Action int

const (
	// Nothing reports no event, as when an Android dialog, permission prompt
	// or picker pauses the activity.
	Nothing Action = iota + 1

	// Native lifecycle events, as native reports them: willEnterForeground and
	// willResignActive are UIInactive, didBecomeActive is UIActive,
	// didEnterBackground is UIBackground. PushWindowBegin and PushWindowEnd
	// bracket a push or notification action, as the bind layer handles one:
	// on iOS they don't reach the controller and return false.
	// DidEnterBackground, and PushWindowEnd when it hands over, start a
	// background task: they wait until it is polling and return true, or until
	// it has ended at once, with nothing to keep running, and return false. A
	// DidEnterBackground while the UI is already in the background starts
	// nothing: it returns true if it joined a running task, false otherwise.
	WillEnterForeground
	DidBecomeActive
	WillResignActive
	DidEnterBackground
	WillTerminate
	BackgroundTaskExpired
	PushWindowBegin
	PushWindowEnd
	LiveLocationAcquire
	LiveLocationRelease

	// BackgroundSyncStart starts the blocking BackgroundSync call and waits
	// until it is waiting out its window (returns true) or has skipped
	// (returns false).
	BackgroundSyncStart
	// BackgroundSyncTimerFires advances the clock past the sync window and
	// waits for BackgroundSync to return.
	BackgroundSyncTimerFires
	// BackgroundSyncWait waits for a BackgroundSync that bails out on its own.
	BackgroundSyncWait

	// BackgroundTaskDelivered finishes the pending work and polls until the
	// task returns.
	BackgroundTaskDelivered
	BackgroundTaskFails
	// BackgroundTaskTimesUp advances the clock past the task's maximum
	// duration with a delivery still pending.
	BackgroundTaskTimesUp
	// BackgroundTaskWait waits for a task that exits on its own, after a
	// state change.
	BackgroundTaskWait

	// WorkStarts makes a delivery pending, so the app must keep running in
	// the background.
	WorkStarts
	// WorkStops clears pending work.
	WorkStops
)

var actionNames = map[Action]string{
	Nothing:                  "Nothing",
	WillEnterForeground:      "WillEnterForeground",
	DidBecomeActive:          "DidBecomeActive",
	WillResignActive:         "WillResignActive",
	DidEnterBackground:       "DidEnterBackground",
	WillTerminate:            "WillTerminate",
	BackgroundTaskExpired:    "BackgroundTaskExpired",
	PushWindowBegin:          "PushWindowBegin",
	PushWindowEnd:            "PushWindowEnd",
	LiveLocationAcquire:      "LiveLocationAcquire",
	LiveLocationRelease:      "LiveLocationRelease",
	BackgroundSyncStart:      "BackgroundSyncStart",
	BackgroundSyncTimerFires: "BackgroundSyncTimerFires",
	BackgroundSyncWait:       "BackgroundSyncWait",
	BackgroundTaskDelivered:  "BackgroundTaskDelivered",
	BackgroundTaskFails:      "BackgroundTaskFails",
	BackgroundTaskTimesUp:    "BackgroundTaskTimesUp",
	BackgroundTaskWait:       "BackgroundTaskWait",
	WorkStarts:               "WorkStarts",
	WorkStops:                "WorkStops",
}

func (a Action) String() string {
	if name, ok := actionNames[a]; ok {
		return name
	}
	return fmt.Sprintf("Action(%d)", int(a))
}

type Return int

const (
	// ReturnNone: the action returns nothing to check.
	ReturnNone Return = iota
	ReturnTrue
	ReturnFalse
)

// Step is one action and what must hold right after it.
type Step struct {
	Do Action
	// Slot names the push window for PushWindowBegin/End.
	Slot int
	Want keybase1.MobileAppState
	// Flushes: how many times local DBs were flushed.
	Flushes int
	// Warn: the user was warned about messages that won't send.
	Warn    bool
	Returns Return
}

type Scenario struct {
	Name     string
	Platform Platform
	Steps    []Step
	// Observed is every state a consumer sees, starting with the initial
	// state.
	Observed []keybase1.MobileAppState
}

// Harness drives a Controller with a fake clock and fake chat deliveries, and
// records what consumers of the app state observe.
type Harness struct {
	T          testing.TB
	Platform   Platform
	AppState   lifecycle.AppState
	Clock      *FakeClock
	Controller *lifecycle.Controller
	Recorder   *Recorder

	flushes      atomic.Int32
	warnings     atomic.Int32
	stay         atomic.Bool
	pending      atomic.Int32
	failures     chan []chat1.OutboxRecord
	tokens       map[int]int64
	liveLocation *lifecycle.Hold

	// A new background task asks Stay the first time only once stayGate lets
	// it, so the recorder sees the BACKGROUNDACTIVE the task may leave at once.
	stayGate chan struct{}
	closing  chan struct{}
	task     int64
	syncDone chan struct{}
	taskDone chan struct{}
	running  sync.WaitGroup
}

const (
	syncWindow   = 10 * time.Second
	pollInterval = 5 * time.Second
	maxDuration  = 10 * time.Minute
)

// NewHarness moves appState to the initial state and starts
// recording. Close it when done.
func NewHarness(t testing.TB, appState lifecycle.AppState, platform Platform) *Harness {
	appState.Update(InitialState)
	h := &Harness{
		T:        t,
		Platform: platform,
		AppState: appState,
		Clock:    NewFakeClock(),
		failures: make(chan []chat1.OutboxRecord, 1),
		tokens:   make(map[int]int64),
		stayGate: make(chan struct{}),
		closing:  make(chan struct{}),
		syncDone: closedChan(),
		taskDone: closedChan(),
	}
	h.Controller = lifecycle.New(appState, lifecycle.Config{
		Clock:                      h.Clock,
		BackgroundSyncWindow:       syncWindow,
		BackgroundTaskPollInterval: pollInterval,
		BackgroundTaskMaxDuration:  maxDuration,
		Flush:                      func() { h.flushes.Add(1) },
		Debug:                      func(format string, args ...interface{}) { t.Logf(format, args...) },
	})
	h.Recorder = NewRecorder(appState)
	return h
}

func closedChan() chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}

// Close ends any background task or sync still running, and the recorder.
func (h *Harness) Close() {
	close(h.closing)
	h.Controller.Close()
	h.Clock.Advance(maxDuration)
	h.running.Wait()
	h.Recorder.Stop()
}

func (h *Harness) Flushes() int  { return int(h.flushes.Load()) }
func (h *Harness) Warnings() int { return int(h.warnings.Load()) }

func (h *Harness) warn() { h.warnings.Add(1) }

func (h *Harness) deps() lifecycle.BackgroundTaskDeps {
	var gated sync.Once
	return lifecycle.BackgroundTaskDeps{
		Stay: func() bool {
			gated.Do(func() {
				select {
				case <-h.stayGate:
				case <-h.closing:
				}
			})
			return h.stay.Load()
		},
		ActiveDeliveries: func(context.Context) ([]chat1.OutboxRecord, error) {
			return make([]chat1.OutboxRecord, h.pending.Load()), nil
		},
		NextFailure:   func() (chan []chat1.OutboxRecord, func()) { return h.failures, func() {} },
		NotifyFailure: func([]chat1.OutboxRecord) { h.warn() },
	}
}

func (h *Harness) goRun(f func()) chan struct{} {
	done := make(chan struct{})
	h.running.Add(1)
	go func() {
		defer h.running.Done()
		defer close(done)
		f()
	}()
	return done
}

func (h *Harness) wait(done chan struct{}, what string) {
	h.T.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		h.T.Fatalf("%s did not return", what)
	}
}

// Do performs step and checks what must hold after it.
func (h *Harness) Do(step Step) {
	t := h.T
	t.Helper()
	flushes, warnings := h.Flushes(), h.Warnings()
	ret := h.perform(step)
	h.Recorder.Sync(t)
	state := h.AppState.State()
	if state != step.Want {
		t.Fatalf("%v: state %v, want %v", step.Do, state, step.Want)
	}
	if got := h.Flushes() - flushes; got != step.Flushes {
		t.Fatalf("%v: %d flushes, want %d", step.Do, got, step.Flushes)
	}
	if got := h.Warnings() - warnings; got != boolInt(step.Warn) {
		t.Fatalf("%v: %d pending-message warnings, want %d", step.Do, got, boolInt(step.Warn))
	}
	if step.Returns != ReturnNone && ret != (step.Returns == ReturnTrue) {
		t.Fatalf("%v: returned %v, want %v", step.Do, ret, step.Returns == ReturnTrue)
	}
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (h *Harness) perform(step Step) bool {
	h.T.Helper()
	c := h.Controller
	switch step.Do {
	case Nothing:
	case WillEnterForeground, WillResignActive:
		c.UIInactive()
	case DidBecomeActive:
		c.UIActive()
	case DidEnterBackground:
		return h.startsTask(func() int64 { return c.UIBackground(h.deps()) })
	case WillTerminate:
		c.WillTerminate(h.warn)
	case BackgroundTaskExpired:
		c.BackgroundTaskExpired(h.warn)
	case PushWindowBegin:
		if h.Platform != Android {
			return false
		}
		h.tokens[step.Slot] = c.PushWindowBegin()
		return h.tokens[step.Slot] > 0
	case PushWindowEnd:
		if h.Platform != Android {
			return false
		}
		return h.startsTask(func() int64 { return c.PushWindowEnd(h.tokens[step.Slot], h.deps()) })
	case LiveLocationAcquire:
		h.liveLocation = c.AcquireBackgroundWork()
	case LiveLocationRelease:
		require.NotNil(h.T, h.liveLocation, "LiveLocationRelease without LiveLocationAcquire")
		h.liveLocation.Release()
	case BackgroundSyncStart:
		h.Clock.ForgetAfters()
		h.syncDone = h.goRun(func() { c.BackgroundSync() })
		return h.Clock.WaitForAfter(h.T, syncWindow, h.syncDone)
	case BackgroundSyncTimerFires:
		h.Clock.Advance(syncWindow)
		h.wait(h.syncDone, "BackgroundSync")
	case BackgroundSyncWait:
		h.wait(h.syncDone, "BackgroundSync")
	case BackgroundTaskDelivered:
		h.stay.Store(false)
		h.pending.Store(0)
		for {
			h.Clock.Advance(pollInterval)
			if !h.Clock.WaitForAfter(h.T, pollInterval, h.taskDone) {
				break
			}
		}
		h.wait(h.taskDone, "background task")
	case BackgroundTaskFails:
		h.failures <- make([]chat1.OutboxRecord, 1)
		h.wait(h.taskDone, "background task")
	case BackgroundTaskTimesUp:
		h.Clock.Advance(maxDuration)
		h.wait(h.taskDone, "background task")
	case BackgroundTaskWait:
		h.wait(h.taskDone, "background task")
	case WorkStarts:
		h.stay.Store(true)
		h.pending.Store(1)
	case WorkStops:
		h.stay.Store(false)
		h.pending.Store(0)
	default:
		h.T.Fatalf("unknown action %v", step.Do)
	}
	return false
}

// startsTask runs a call that may start a background task and, if it did,
// waits until the task is polling or has ended. It reports whether the task
// is running.
func (h *Harness) startsTask(call func() int64) bool {
	h.T.Helper()
	h.Clock.ForgetAfters()
	token := call()
	if token == 0 {
		return false
	}
	if token == h.task {
		// The call reused the running task's hold; that task is past Stay.
		select {
		case <-h.taskDone:
			return false
		default:
			return true
		}
	}
	h.task = token
	h.taskDone = h.goRun(func() { h.Controller.WaitBackgroundTask(token) })
	h.Recorder.Sync(h.T)
	select {
	case h.stayGate <- struct{}{}:
	case <-time.After(5 * time.Second):
		h.T.Fatalf("background task %d never asked whether to stay", token)
	}
	return h.Clock.WaitForAfter(h.T, pollInterval, h.taskDone)
}

// Play runs every step of sc on a fresh harness and checks the observed
// states. afterStep, if set, runs after each step's checks, for a consumer
// test to check its own reaction.
func Play(t *testing.T, appState lifecycle.AppState, sc Scenario, afterStep func(h *Harness, i int, step Step)) {
	t.Helper()
	h := NewHarness(t, appState, sc.Platform)
	defer h.Close()
	for i, step := range sc.Steps {
		h.Do(step)
		if afterStep != nil {
			afterStep(h, i, step)
		}
	}
	h.CheckObserved(sc.Observed)
}

func (h *Harness) CheckObserved(want []keybase1.MobileAppState) {
	h.T.Helper()
	got := h.Recorder.States()
	if fmt.Sprint(got) != fmt.Sprint(want) {
		h.T.Fatalf("observed states %v, want %v", got, want)
	}
}

// NoWork is what a background task sees when nothing must keep a backgrounded
// app running: it ends at once.
func NoWork() lifecycle.BackgroundTaskDeps {
	return lifecycle.BackgroundTaskDeps{Stay: func() bool { return false }}
}

// ToBackground reports the UI in the background with nothing to keep running,
// and returns once the background task that starts, if any, has ended.
func ToBackground(c *lifecycle.Controller) {
	c.WaitBackgroundTask(c.UIBackground(NoWork()))
}
