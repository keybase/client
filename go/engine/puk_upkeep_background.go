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
	Start:        20 * time.Second, // Wait after starting the app
	StartStagger: 20 * time.Second, // Wait an additional random amount.
	WakeUp:       15 * time.Second, // Additional delay after waking from sleep.
	Interval:     6 * time.Hour,    // Wait between checks
	Limit:        5 * time.Minute,  // Time limit on each round
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
func (e *PerUserKeyUpkeepBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *PerUserKeyUpkeepBackground) Shutdown() {
	e.task.Shutdown()
}

func PerUserKeyUpkeepBackgroundRound(m libkb.MetaContext) error {
	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.Debug("PerUserKeyUpkeepBackgroundRound giving up offline")
		return nil
	}

	if !m.G().ActiveDevice.Valid() {
		m.Debug("PerUserKeyUpkeepBackgroundRound not logged in")
		return nil
	}

	if !m.G().LocalSigchainGuard().IsAvailable(m.Ctx(), "PerUserKeyUpkeepBackgroundRound") {
		m.Debug("PerUserKeyUpkeepBackgroundRound yielding to guard")
		return nil
	}

	arg := &PerUserKeyUpkeepArgs{}
	eng := NewPerUserKeyUpkeep(m.G(), arg)
	err := RunEngine2(m, eng)
	return err
}
