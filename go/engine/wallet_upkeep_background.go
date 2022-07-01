// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// WalletUpkeepBackground keeps the wallet bundle encrypted for the latest puk.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var WalletUpkeepBackgroundSettings = BackgroundTaskSettings{
	Start:        40 * time.Second, // Wait after starting the app.
	StartStagger: 20 * time.Second, // Wait an additional random amount.
	WakeUp:       20 * time.Second, // Additional delay after waking from sleep.
	Interval:     24 * time.Hour,   // Wait between checks
	Limit:        10 * time.Minute, // Time limit on each round
}

// WalletUpkeepBackground is an engine.
type WalletUpkeepBackground struct {
	libkb.Contextified
	sync.Mutex

	args *WalletUpkeepBackgroundArgs
	task *BackgroundTask
}

type WalletUpkeepBackgroundArgs struct {
	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewWalletUpkeepBackground creates a WalletUpkeepBackground engine.
func NewWalletUpkeepBackground(g *libkb.GlobalContext, args *WalletUpkeepBackgroundArgs) *WalletUpkeepBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "WalletUpkeepBackground",
		F:        WalletUpkeepBackgroundRound,
		Settings: WalletUpkeepBackgroundSettings,

		testingMetaCh:     args.testingMetaCh,
		testingRoundResCh: args.testingRoundResCh,
	})
	return &WalletUpkeepBackground{
		Contextified: libkb.NewContextified(g),
		args:         args,
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

// Name is the unique engine name.
func (e *WalletUpkeepBackground) Name() string {
	return "WalletUpkeepBackground"
}

// GetPrereqs returns the engine prereqs.
func (e *WalletUpkeepBackground) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *WalletUpkeepBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WalletUpkeepBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *WalletUpkeepBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *WalletUpkeepBackground) Shutdown() {
	e.task.Shutdown()
}

func WalletUpkeepBackgroundRound(m libkb.MetaContext) error {
	g := m.G()
	if g.ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.Debug("WalletUpkeepBackgroundRound giving up offline")
		return nil
	}

	if !g.ActiveDevice.Valid() {
		m.Debug("WalletUpkeepBackgroundRound not logged in")
		return nil
	}

	if !g.LocalSigchainGuard().IsAvailable(m.Ctx(), "WalletUpkeepBackgroundRound") {
		m.Debug("WalletUpkeepBackgroundRound yielding to guard")
		return nil
	}

	return g.GetStellar().Upkeep(m.Ctx())
}
