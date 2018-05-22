// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// WalletInitBackground creates the initial wallet for a user the the background.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var WalletInitBackgroundSettings = BackgroundTaskSettings{
	// Wait after starting the app
	Start: 15 * time.Second,
	// When waking up on mobile lots of timers will go off at once. We wait an additional
	// delay so as not to add to that herd and slow down the mobile experience when opening the app.
	WakeUp: 12 * time.Second,
	// Wait between checks
	Interval: 6 * time.Hour,
	// Time limit on each round
	Limit: 5 * time.Minute,
}

// WalletInitBackground is an engine.
type WalletInitBackground struct {
	libkb.Contextified
	sync.Mutex

	args *WalletInitBackgroundArgs
	task *BackgroundTask
}

type WalletInitBackgroundArgs struct {
	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewWalletInitBackground creates a WalletInitBackground engine.
func NewWalletInitBackground(g *libkb.GlobalContext, args *WalletInitBackgroundArgs) *WalletInitBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "WalletInitBackground",
		F:        WalletInitBackgroundRound,
		Settings: WalletInitBackgroundSettings,

		testingMetaCh:     args.testingMetaCh,
		testingRoundResCh: args.testingRoundResCh,
	})
	return &WalletInitBackground{
		Contextified: libkb.NewContextified(g),
		args:         args,
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

// Name is the unique engine name.
func (e *WalletInitBackground) Name() string {
	return "WalletInitBackground"
}

// GetPrereqs returns the engine prereqs.
func (e *WalletInitBackground) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *WalletInitBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WalletInitBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *WalletInitBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *WalletInitBackground) Shutdown() {
	e.task.Shutdown()
}

func WalletInitBackgroundRound(m libkb.MetaContext) error {
	m = m.WithLogTag("WBG")
	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.CDebugf("WalletInitBackgroundRound giving up offline")
		return nil
	}

	if !m.G().ActiveDevice.Valid() {
		m.CDebugf("WalletInitBackground not logged in")
		return nil
	}

	if !m.G().LocalSigchainGuard().IsAvailable(m.Ctx(), "WalletInitBackground") {
		m.CDebugf("WalletInitBackgroundRound yielding to guard")
		return nil
	}

	_, err := m.G().GetStellar().CreateWalletGated(m)
	return err
}
