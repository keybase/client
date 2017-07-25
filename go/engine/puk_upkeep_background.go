// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyUpkeepBackground runs PerUserKeyUpkeep in the background once in a while.
// It rolls the per-user-key if the last one was involved in a deprovision.
// See PerUserKeyUpkeep for more info.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var PerUserKeyUpkeepBackgroundSettings = BackgroundTaskSettings{
	// Wait after starting the app
	Start: 20 * time.Second,
	// When waking up on mobile lots of timers will go off at once. We wait an additional
	// delay so as not to add to that herd and slow down the mobile experience when opening the app.
	WakeUp: 15 * time.Second,
	// Wait between checks
	Interval: 6 * time.Hour,
	// Time limit on each round
	Limit: 5 * time.Minute,
}

// PerUserKeyUpkeepBackground is an engine.
type PerUserKeyUpkeepBackground struct {
	libkb.Contextified
	sync.Mutex

	args *PerUserKeyUpkeepBackgroundArgs
	task *BackgroundTask
}

type PerUserKeyUpkeepBackgroundArgs struct {
	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewPerUserKeyUpkeepBackground creates a PerUserKeyUpkeepBackground engine.
func NewPerUserKeyUpkeepBackground(g *libkb.GlobalContext, args *PerUserKeyUpkeepBackgroundArgs) *PerUserKeyUpkeepBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "PerUserKeyUpkeepBackground",
		F:        PerUserKeyUpkeepBackgroundRound,
		Settings: PerUserKeyUpkeepBackgroundSettings,

		testingMetaCh:     args.testingMetaCh,
		testingRoundResCh: args.testingRoundResCh,
	})
	return &PerUserKeyUpkeepBackground{
		Contextified: libkb.NewContextified(g),
		args:         args,
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

// Name is the unique engine name.
func (e *PerUserKeyUpkeepBackground) Name() string {
	return "PerUserKeyUpkeepBackground"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyUpkeepBackground) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyUpkeepBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyUpkeepBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PerUserKeyUpkeep{}}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *PerUserKeyUpkeepBackground) Run(ctx *Context) (err error) {
	return RunEngine(e.task, ctx)
}

func (e *PerUserKeyUpkeepBackground) Shutdown() {
	e.task.Shutdown()
}

func PerUserKeyUpkeepBackgroundRound(g *libkb.GlobalContext, ectx *Context) error {
	if g.ConnectivityMonitor.IsConnected(ectx.GetNetContext()) == libkb.ConnectivityMonitorNo {
		g.Log.CDebugf(ectx.GetNetContext(), "PerUserKeyUpkeepBackgroundRound giving up offline")
		return nil
	}

	if !g.LocalSigchainGuard().IsAvailable(ectx.GetNetContext(), "PerUserKeyUpkeepBackgroundRound") {
		g.Log.CDebugf(ectx.GetNetContext(), "PerUserKeyUpkeepBackgroundRound yielding to guard")
		return nil
	}

	arg := &PerUserKeyUpkeepArgs{}
	eng := NewPerUserKeyUpkeep(g, arg)
	err := RunEngine(eng, ectx)
	return err
}
