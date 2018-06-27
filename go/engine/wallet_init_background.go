// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// WalletInitBackground creates the initial wallet for a user the the background.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

var WalletInitBackgroundSettings = BackgroundTaskSettings{
	Start:        15 * time.Second, // Wait after starting the app
	StartStagger: 30 * time.Second, // Wait an additional random amount.
	WakeUp:       12 * time.Second, // Additional delay after waking from sleep.
	Interval:     6 * time.Hour,    // Wait between checks
	Limit:        5 * time.Minute,  // Time limit on each round
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
	g := m.G()
	if g.ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.CDebugf("WalletInitBackgroundRound giving up offline")
		return nil
	}

	if !g.ActiveDevice.Valid() {
		m.CDebugf("WalletInitBackground not logged in")
		return nil
	}

	if !g.LocalSigchainGuard().IsAvailable(m.Ctx(), "WalletInitBackground") {
		m.CDebugf("WalletInitBackgroundRound yielding to guard")
		return nil
	}

	return g.GetStellar().CreateWalletGated(context.Background())
}
