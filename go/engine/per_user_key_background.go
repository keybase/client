// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyBackground runs PerUserKeyUpgrade in the background once in a while.
// It brings users without per-user-keys up to having them.
// Note that this engine is long-lived and potentially has to deal with being
// logged out and logged in as a different user, etc.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

type PerUserKeyBackgroundSettings struct {
	Start    time.Duration
	WakeUp   time.Duration
	Interval time.Duration
	Limit    time.Duration
}

var PerUserKeyBackgroundDefaultSettings = PerUserKeyBackgroundSettings{
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

// PerUserKeyBackground is an engine.
type PerUserKeyBackground struct {
	libkb.Contextified
	sync.Mutex

	args *PerUserKeyBackgroundArgs

	shutdown bool
	// Function to cancel the background context.
	// Can be nil before RunEngine exits
	shutdownFunc context.CancelFunc
}

type PerUserKeyBackgroundArgs struct {
	Settings PerUserKeyBackgroundSettings

	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewPerUserKeyBackground creates a PerUserKeyBackground engine.
func NewPerUserKeyBackground(g *libkb.GlobalContext, args *PerUserKeyBackgroundArgs) *PerUserKeyBackground {
	return &PerUserKeyBackground{
		Contextified: libkb.NewContextified(g),
		args:         args,
		shutdownFunc: nil,
	}
}

// Name is the unique engine name.
func (e *PerUserKeyBackground) Name() string {
	return "PerUserKeyBackground"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyBackground) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PerUserKeyUpgrade{}}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *PerUserKeyBackground) Run(ectx *Context) (err error) {
	ctx := ectx.NetContext
	defer e.G().CTrace(ctx, "PerUserKeyBackground", func() error { return err })()

	// use a new background context with a saved cancel function
	ctx, cancel := context.WithCancel(context.Background())

	e.Lock()
	defer e.Unlock()

	e.shutdownFunc = cancel
	if e.shutdown {
		// Shutdown before started
		cancel()
		e.meta("early-shutdown")
		return nil
	}

	// start the loop and return
	go func() {
		e.meta("loop-start")
		err := e.loop(ctx, ectx)
		if err != nil {
			e.G().Log.CDebugf(ctx, "PerUserKeyBackground loop error: %s", err)
		}
		cancel()
		e.meta("loop-exit")
	}()

	return nil
}

func (e *PerUserKeyBackground) Shutdown() {
	e.Lock()
	defer e.Unlock()
	e.shutdown = true
	if e.shutdownFunc != nil {
		e.shutdownFunc()
	}
}

func (e *PerUserKeyBackground) loop(ctx context.Context, ectx *Context) error {
	if err := libkb.SleepWithContext(ctx, e.G().Clock(), e.args.Settings.Start); err != nil {
		return err
	}
	e.meta("woke-start")
	var i int
	for {
		i++
		err := e.round(ctx, ectx)
		if err != nil {
			e.G().Log.CDebugf(ctx, "PerUserKeyBackground round(%v) error: %s", i, err)
		} else {
			e.G().Log.CDebugf(ctx, "PerUserKeyBackground round(%v) complete", i)
		}
		if e.args.testingRoundResCh != nil {
			e.args.testingRoundResCh <- err
		}
		if err := libkb.SleepWithContext(ctx, e.G().Clock(), e.args.Settings.Interval); err != nil {
			return err
		}
		e.meta("woke-interval")
		if err := libkb.SleepWithContext(ctx, e.G().Clock(), e.args.Settings.WakeUp); err != nil {
			return err
		}
		e.meta("woke-wakeup")
	}
}

func (e *PerUserKeyBackground) round(ctx context.Context, ectx *Context) error {
	ctx, cancel := context.WithTimeout(ctx, e.args.Settings.Limit)
	defer cancel()

	if !e.G().Env.GetUpgradePerUserKey() {
		e.G().Log.CDebugf(ctx, "CheckUpgradePerUserKey disabled")
		return nil
	}

	if e.G().ConnectivityMonitor.IsConnected(ctx) == libkb.ConnectivityMonitorNo {
		e.G().Log.CDebugf(ctx, "CheckUpgradePerUserKey giving up offline")
		return nil
	}

	// Do a fast local check to see if our work is done.
	pukring, err := e.G().GetPerUserKeyring()
	if err == nil {
		if pukring.HasAnyKeys() {
			e.G().Log.CDebugf(ctx, "CheckUpgradePerUserKey already has keys")
			return nil
		}
	}

	arg := &PerUserKeyUpgradeArgs{}
	eng := NewPerUserKeyUpgrade(e.G(), arg)
	err = RunEngine(eng, ectx.WithNetContext(ctx))
	return err
}

func (e *PerUserKeyBackground) meta(s string) {
	if e.args.testingMetaCh != nil {
		e.args.testingMetaCh <- s
	}
}
