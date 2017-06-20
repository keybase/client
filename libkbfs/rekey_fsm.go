// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/tlf"
)

/*

 This file defines a finite state machine (FSM) for rekey operation scheduling.
 The state chart is described in following dot graph:

digraph rekeyFSM {
  graph [rankdir=LR]
  start [shape=plaintext]

  Idle -> Idle [label="*"]
  Scheduled -> Scheduled [label="*"]
  Started -> Started [label="*"]

  start -> Idle
  Idle -> Scheduled [label=Request]
  Scheduled -> Scheduled [label="Request,RekeyNotNeeded"]
  Scheduled -> Started [label=Timeup]
  Started -> Scheduled [label="Finished(TTL valid && (rekey done || needs paper))"]
  Started -> Idle [label="Finished (*)"]
}

*/

// CtxRekeyTagKey is the type used for unique context tags within an
// enqueued Rekey.
type CtxRekeyTagKey int

const (
	// CtxRekeyIDKey is the type of the tag for unique operation IDs
	// within an enqueued Rekey.
	CtxRekeyIDKey CtxRekeyTagKey = iota
)

// CtxRekeyOpID is the display name for the unique operation
// enqueued rekey ID tag.
const CtxRekeyOpID = "REKEYID"

type rekeyEventType int

const (
	_ rekeyEventType = iota
	rekeyRequestEvent
	rekeyFinishedEvent
	rekeyTimeupEvent
	rekeyNotNeededEvent

	rekeyShutdownEvent

	rekeyKickoffEventForTest
	rekeyCancelEventForTest
)

func (e rekeyEventType) String() string {
	switch e {
	case rekeyRequestEvent:
		return "rekeyRequestEvent"
	case rekeyFinishedEvent:
		return "rekeyFinishedEvent"
	case rekeyTimeupEvent:
		return "rekeyTimeupEvent"
	case rekeyNotNeededEvent:
		return "rekeyNotNeededEvent"
	case rekeyShutdownEvent:
		return "rekeyShutdownEvent"
	case rekeyKickoffEventForTest:
		return "rekeyKickoffEventForTest"
	case rekeyCancelEventForTest:
		return "rekeyCancelEventForTest"
	default:
		return "unknown"
	}
}

// rekeyTask describes a rekey task.
type rekeyTask struct {
	// timeout, if non-nil, causes rekey to fail if it takes more than this
	// duration since it enters rekeyStateStarted.
	timeout     *time.Duration
	ttl         int
	promptPaper bool

	ctx *protectedContext
}

// rekeyRequest describes a rekey request.
type rekeyRequest struct {
	// delay is the duration to wait for since the request enters the FSM until
	// starting the rekey.
	delay time.Duration
	rekeyTask
}

// rekeyFinished describes a rekeyFinishedEvent. It contains results from an
// actual rekey operation.
type rekeyFinished struct {
	RekeyResult
	err error
}

// RekeyEvent describes an event to send into the RekeyFSM. A function, e.g.,
// NewRekeyRequestEvent, should be used to construct one.
type RekeyEvent struct {
	eventType rekeyEventType
	request   *rekeyRequest
	finished  *rekeyFinished
}

func (e RekeyEvent) String() string {
	switch e.eventType {
	case rekeyRequestEvent:
		return fmt.Sprintf("%s [%#+v]", e.eventType, e.request)
	case rekeyFinishedEvent:
		return fmt.Sprintf("%s [%#+v]", e.eventType, e.finished)
	default:
		return e.eventType.String()
	}
}

func newRekeyRequestEvent(req rekeyRequest) RekeyEvent {
	return RekeyEvent{
		eventType: rekeyRequestEvent,
		request:   &req,
	}
}

func newRekeyRequestEventWithContext(ctx context.Context) RekeyEvent {
	return newRekeyRequestEvent(rekeyRequest{
		delay: 0,
		rekeyTask: rekeyTask{
			timeout:     nil,
			promptPaper: false,
			ttl:         rekeyInitialTTL,
			ctx:         newProtectedContext(ctx, nil),
		},
	})
}

// NewRekeyRequestWithPaperPromptEvent creates a non-delayed rekey request
// Event that causes a paper prompt.
func NewRekeyRequestWithPaperPromptEvent() RekeyEvent {
	e := NewRekeyRequestEvent()
	d := rekeyWithPromptWaitTimeDefault
	e.request.promptPaper = true
	e.request.timeout = &d
	return e
}

// NewRekeyRequestEvent creates a non-delayed rekey request Event.
func NewRekeyRequestEvent() RekeyEvent {
	return newRekeyRequestEventWithContext(ctxWithRandomIDReplayable(
		context.Background(), CtxRekeyIDKey, CtxRekeyOpID, nil))
}

// NewRekeyNotNeededEvent creates a rekeyNotNeededEvent typed event. If the FSM
// is in rekeyStateScheduled, this causes FSM to unset paperkey prompt. In
// other states nothing happens. This event is sent to the FSM when we see a MD
// update with rekey flag unset. It can be an indication that an old
// outstanding rekey request has been served by another device, or just a
// regular rekey updates.
func NewRekeyNotNeededEvent() RekeyEvent {
	return RekeyEvent{
		eventType: rekeyNotNeededEvent,
	}
}

func newRekeyFinishedEvent(res RekeyResult, err error) RekeyEvent {
	return RekeyEvent{
		eventType: rekeyFinishedEvent,
		finished: &rekeyFinished{
			RekeyResult: res,
			err:         err,
		},
	}
}

func newRekeyTimeupEvent() RekeyEvent {
	return RekeyEvent{
		eventType: rekeyTimeupEvent,
	}
}

func newRekeyShutdownEvent() RekeyEvent {
	return RekeyEvent{
		eventType: rekeyShutdownEvent,
	}
}

func newRekeyKickoffEventForTest() RekeyEvent {
	return RekeyEvent{
		eventType: rekeyKickoffEventForTest,
	}
}

func newRekeyCancelEventForTest() RekeyEvent {
	return RekeyEvent{
		eventType: rekeyCancelEventForTest,
	}
}

// rekeyState models a state in the FSM. rekeyFSM keeps exactly one instance of
// rekeyState at any given time.
type rekeyState interface {
	// reactToEvent defines how this state reacts to an event. Implementations of
	// rekeyState should handle necessary transition actions in reactToEvent(),
	// and return a new rekeyState instance after transition is finished.
	// rekeyFSM sends event to the rekeyState instance it holds whenever it
	// receives an event, and use the returned rekeyState instance as new state.
	// It's OK to return the receiver itself as "new" state.
	//
	// rekeyFSM runs an event loop in a dedicated goroutine that calls
	// reactToEvent and updates states. In other words, it's safe to assume
	// reactToEvent is only called within the same goroutine, and that it's
	// impossible that multiple reactToEvent calls are issued concurrently.
	reactToEvent(event RekeyEvent) rekeyState
}

type rekeyStateIdle struct {
	fsm *rekeyFSM
}

func newRekeyStateIdle(fsm *rekeyFSM) *rekeyStateIdle {
	return &rekeyStateIdle{fsm: fsm}
}

func (r *rekeyStateIdle) reactToEvent(event RekeyEvent) rekeyState {
	switch event.eventType {
	case rekeyRequestEvent:
		return newRekeyStateScheduled(r.fsm,
			event.request.delay, event.request.rekeyTask)
	default:
		return r
	}
}

type rekeyStateScheduled struct {
	fsm *rekeyFSM

	timer    *time.Timer
	deadline time.Time

	task rekeyTask
}

func newRekeyStateScheduled(
	fsm *rekeyFSM, delay time.Duration, task rekeyTask) *rekeyStateScheduled {
	task.ctx.setLogger(fsm.log)
	return &rekeyStateScheduled{
		fsm: fsm,
		timer: time.AfterFunc(delay, func() {
			fsm.Event(newRekeyTimeupEvent())
		}),
		deadline: time.Now().Add(delay),
		task:     task,
	}
}

func (r *rekeyStateScheduled) reactToEvent(event RekeyEvent) rekeyState {
	switch event.eventType {
	case rekeyTimeupEvent:
		return newRekeyStateStarted(r.fsm, r.task)
	case rekeyRequestEvent:
		if r.task.promptPaper && !event.request.promptPaper {
			// KBFS-2251: If fbo concludes that paper key would be needed in
			// order for rekey to proceed, it writes a MD to mdserver with
			// rekey set at the same time. To prevent the FSM from being kicked
			// of to rekeyStateStarted right away after receiving this update
			// (through FoldersNeedRekey) from mdserver, we just reuse the same
			// timer if r.task.promptPaper is set.
			//
			// If the request has promptPaper set, then it's from the KBFS
			// client, likely due to a read request. In this case, we should
			// shorten the wait timer according the the request.
			r.fsm.log.CDebugf(r.task.ctx.context(), "Reusing existing timer "+
				"without possibly shortening due to r.task.promptPaper==true")
			return r
		}

		task := r.task
		task.promptPaper = task.promptPaper || event.request.promptPaper
		if task.timeout == nil {
			task.timeout = event.request.timeout
		}
		task.ttl = event.request.ttl
		task.ctx.maybeReplaceContext(event.request.ctx.context())
		if !r.deadline.After(time.Now().Add(event.request.delay)) {
			r.fsm.log.CDebugf(task.ctx.context(), "Reusing existing timer")
			r.task = task
			return r
		}
		r.timer.Stop()
		return newRekeyStateScheduled(r.fsm, event.request.delay, task)
	case rekeyNotNeededEvent:
		// KBFS-2254: if another device finished rekey, we should unset the
		// paperkey prompt so that if this other device goes offline before a
		// third device triggers a rekey request, the timer can be preempted.
		// What if the FoldersNeedRekey call comes in before this and we still
		// miss the rekey request? Well now we also send a rekey request into
		// the FSM on MD updates with rekey flag set. Since the MD updates are
		// applied in order, and that FSM's state transition is
		// single-goroutined, we are safe here.
		r.task.promptPaper = false
		return r
	case rekeyKickoffEventForTest:
		r.timer.Reset(time.Millisecond)
		return r
	case rekeyCancelEventForTest:
		r.timer.Stop()
		return newRekeyStateIdle(r.fsm)
	case rekeyShutdownEvent:
		r.timer.Stop()
		return r
	default:
		return r
	}
}

type rekeyStateStarted struct {
	fsm  *rekeyFSM
	task rekeyTask
}

func newRekeyStateStarted(fsm *rekeyFSM, task rekeyTask) *rekeyStateStarted {
	ctx := task.ctx.context()
	var cancel context.CancelFunc
	if task.timeout != nil {
		ctx, cancel = context.WithTimeout(task.ctx.context(), *task.timeout)
	}
	go func() {
		if cancel != nil {
			defer cancel()
		}
		fsm.log.CDebugf(ctx, "Processing rekey for %s", fsm.fbo.folderBranch.Tlf)
		var res RekeyResult
		err := fsm.fbo.doMDWriteWithRetryUnlessCanceled(ctx,
			func(lState *lockState) (err error) {
				res, err = fsm.fbo.rekeyLocked(ctx, lState, task.promptPaper)
				return err
			})
		fsm.log.CDebugf(ctx, "Rekey finished with res=%#+v, error=%v", res, err)
		fsm.Event(newRekeyFinishedEvent(res, err))
	}()
	return &rekeyStateStarted{
		fsm:  fsm,
		task: task,
	}
}

func (r *rekeyStateStarted) reactToEvent(event RekeyEvent) rekeyState {
	switch event.eventType {
	case rekeyFinishedEvent:
		ttl := r.task.ttl - 1
		r.fsm.log.CDebugf(r.task.ctx.context(),
			"Rekey finished, ttl: %d -> %d", r.task.ttl, ttl)

		if ttl <= 0 {
			r.fsm.log.CDebugf(r.task.ctx.context(),
				"Not scheduling new rekey because TTL expired")
			return newRekeyStateIdle(r.fsm)
		}

		switch event.finished.err {
		case nil:
		default:
			r.fsm.log.CDebugf(r.task.ctx.context(),
				"Rekey errored; scheduling new rekey in %s", rekeyRecheckInterval)
			return newRekeyStateScheduled(r.fsm, rekeyRecheckInterval, rekeyTask{
				timeout:     r.task.timeout,
				promptPaper: r.task.promptPaper,
				ttl:         ttl,
				ctx:         r.task.ctx,
			})
		}

		d := r.fsm.fbo.config.RekeyWithPromptWaitTime()
		if event.finished.NeedsPaperKey {
			r.fsm.log.CDebugf(r.task.ctx.context(),
				"Scheduling rekey due to NeedsPaperKey==true")
			return newRekeyStateScheduled(r.fsm, d, rekeyTask{
				timeout:     &d,
				promptPaper: true,
				ttl:         ttl,
				ctx:         r.task.ctx,
			})
		}

		if event.finished.DidRekey {
			// We enqueue the rekey here again, in case we missed a device due to a
			// race condition. This is specifically for the situation where user
			// provisions two devices in a row, and the key update for the 2nd device
			// only comes in after rekey for a TLF is done, which didn't include the
			// second device. At this point, there wouldn't be a new MD with rekey
			// bit set since it's already set. As a result, the TLF won't get rekeyed
			// for the second device until the next 1-hour timer triggers another
			// scan.
			r.fsm.log.CDebugf(r.task.ctx.context(),
				"Scheduling rekey (recheck) due to DidRekey==true")
			return newRekeyStateScheduled(r.fsm, rekeyRecheckInterval, rekeyTask{
				timeout:     nil,
				promptPaper: false,
				ttl:         ttl,
				ctx:         r.task.ctx,
			})
		}

		r.fsm.log.CDebugf(r.task.ctx.context(),
			"Not scheduling rekey because no more rekeys or rechecks are needed")
		return newRekeyStateIdle(r.fsm)
	default:
		return r
	}
}

type rekeyFSMListener struct {
	repeatedly bool
	onEvent    func(RekeyEvent)
}

type rekeyFSM struct {
	shutdownCh chan struct{}
	reqs       chan RekeyEvent

	fbo *folderBranchOps
	log logger.Logger

	current rekeyState

	muListeners sync.Mutex
	listeners   map[rekeyEventType][]rekeyFSMListener
}

// NewRekeyFSM creates a new rekey FSM.
func NewRekeyFSM(fbo *folderBranchOps) RekeyFSM {
	fsm := &rekeyFSM{
		reqs:       make(chan RekeyEvent, rekeyQueueSize),
		shutdownCh: make(chan struct{}),
		fbo:        fbo,
		log:        fbo.config.MakeLogger("RekeyFSM"),

		listeners: make(map[rekeyEventType][]rekeyFSMListener),
	}
	fsm.current = newRekeyStateIdle(fsm)
	go fsm.loop()
	return fsm
}

func (m *rekeyFSM) loop() {
	reqs := m.reqs
	for {
		select {
		case e := <-reqs:
			if e.eventType == rekeyShutdownEvent {
				// Set reqs to nil so on next iteration, we will skip any
				// content in reqs. So if there are multiple
				// rekeyShutdownEvent, we won't close m.shutdownCh multiple
				// times.
				reqs = nil
				close(m.shutdownCh)
			}

			next := m.current.reactToEvent(e)
			m.log.Debug("RekeyFSM transition: %T + %s -> %T",
				m.current, e, next)
			m.current = next

			m.triggerCallbacksForTest(e)
		case <-m.shutdownCh:
			return
		}
	}
}

// Event implements RekeyFSM interface for rekeyFSM.
func (m *rekeyFSM) Event(event RekeyEvent) {
	select {
	case m.reqs <- event:
	case <-m.shutdownCh:
	}
}

// Shutdown implements RekeyFSM interface for rekeyFSM.
func (m *rekeyFSM) Shutdown() {
	m.Event(newRekeyShutdownEvent())
}

func (m *rekeyFSM) triggerCallbacksForTest(e RekeyEvent) {
	var cbs []rekeyFSMListener
	func() {
		m.muListeners.Lock()
		defer m.muListeners.Unlock()
		cbs = m.listeners[e.eventType]
		m.listeners[e.eventType] = nil
		for _, cb := range cbs {
			if cb.repeatedly {
				m.listeners[e.eventType] = append(
					m.listeners[e.eventType], cb)
			}
		}
	}()
	for _, cb := range cbs {
		cb.onEvent(e)
	}
}

// listenOnEvent implements RekeyFSM interface for rekeyFSM.
func (m *rekeyFSM) listenOnEvent(
	event rekeyEventType, callback func(RekeyEvent), repeatedly bool) {
	m.muListeners.Lock()
	defer m.muListeners.Unlock()
	m.listeners[event] = append(m.listeners[event], rekeyFSMListener{
		onEvent:    callback,
		repeatedly: repeatedly,
	})
}

func getRekeyFSM(ops KBFSOps, tlfID tlf.ID) RekeyFSM {
	switch o := ops.(type) {
	case *KBFSOpsStandard:
		return o.getOpsNoAdd(FolderBranch{Tlf: tlfID, Branch: MasterBranch}).rekeyFSM
	case *folderBranchOps:
		return o.rekeyFSM
	default:
		panic("unknown KBFSOps")
	}
}

// RequestRekeyAndWaitForOneFinishEvent sends a rekey request to the FSM
// associated with tlfID, and wait for exact one rekeyFinished event. This can
// be useful for waiting for a rekey result in tests.
//
// Note that the supplied ctx is injected to the rekey task, so canceling ctx
// would actually cancel the rekey.
//
// Currently this is only used in tests and RekeyFile. Normal rekey activities
// should go through the FSM asychronously.
func RequestRekeyAndWaitForOneFinishEvent(ctx context.Context,
	ops KBFSOps, tlfID tlf.ID) (res RekeyResult, err error) {
	fsm := getRekeyFSM(ops, tlfID)
	rekeyWaiter := make(chan struct{})
	fsm.listenOnEvent(rekeyFinishedEvent, func(e RekeyEvent) {
		res = e.finished.RekeyResult
		err = e.finished.err
		close(rekeyWaiter)
	}, false)
	fsm.Event(newRekeyRequestEventWithContext(ctx))
	<-rekeyWaiter
	return res, err
}
