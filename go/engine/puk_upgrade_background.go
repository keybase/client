// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyUpgradeBackground runs PerUserKeyUpgrade in the background once in a while.
// It brings users without per-user-keys up to having them.
// Note that this engine is long-lived and potentially has to deal with being
// logged out and logged in as a different user, etc.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var PerUserKeyUpgradeBackgroundSettings = BackgroundTaskSettings{
	// Wait after starting the app
	Start: 30 * time.Second,
	// When waking up on mobile lots of timers will go off at once. We wait an additional
	// delay so as not to add to that herd and slow down the mobile experience when opening the app.
	WakeUp: 10 * time.Second,
	// Wait between checks
	Interval: 1 * time.Hour,
	// Time limit on each round
	Limit: 5 * time.Minute,
}

// PerUserKeyUpgradeBackground is an engine.
type PerUserKeyUpgradeBackground struct {
	libkb.Contextified
	sync.Mutex

	args *PerUserKeyUpgradeBackgroundArgs
	task *BackgroundTask
}

type PerUserKeyUpgradeBackgroundArgs struct {
	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewPerUserKeyUpgradeBackground creates a PerUserKeyUpgradeBackground engine.
func NewPerUserKeyUpgradeBackground(g *libkb.GlobalContext, args *PerUserKeyUpgradeBackgroundArgs) *PerUserKeyUpgradeBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "PerUserKeyUpgradeBackground",
		F:        PerUserKeyUpgradeBackgroundRound,
		Settings: PerUserKeyUpgradeBackgroundSettings,

		testingMetaCh:     args.testingMetaCh,
		testingRoundResCh: args.testingRoundResCh,
	})
	return &PerUserKeyUpgradeBackground{
		Contextified: libkb.NewContextified(g),
		args:         args,
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

// Name is the unique engine name.
func (e *PerUserKeyUpgradeBackground) Name() string {
	return "PerUserKeyUpgradeBackground"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyUpgradeBackground) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyUpgradeBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyUpgradeBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PerUserKeyUpgrade{}}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *PerUserKeyUpgradeBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *PerUserKeyUpgradeBackground) Shutdown() {
	e.task.Shutdown()
}

func PerUserKeyUpgradeBackgroundRound(m libkb.MetaContext) error {
	if !m.G().Env.GetUpgradePerUserKey() {
		m.CDebugf("PerUserKeyUpgradeBackground disabled")
		return nil
	}

	if !m.G().LocalSigchainGuard().IsAvailable(m.Ctx(), "PerUserKeyUpgradeBackgroundRound") {
		m.CDebugf("PerUserKeyUpgradeBackground yielding to guard")
		return nil
	}

	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.CDebugf("PerUserKeyUpgradeBackground giving up offline")
		return nil
	}

	// Do a fast local check to see if our work is done.
	pukring, err := m.G().GetPerUserKeyring()
	if err != nil {
		m.CDebugf("PerUserKeyUpgradeBackground error getting keyring: %v", err)
		// ignore error
	}
	if err == nil {
		if pukring.HasAnyKeys() {
			m.CDebugf("PerUserKeyUpgradeBackground already has keys")
			return nil
		}
	}

	arg := &PerUserKeyUpgradeArgs{}
	eng := NewPerUserKeyUpgrade(m.G(), arg)
	err = RunEngine2(m, eng)
	return err
}
