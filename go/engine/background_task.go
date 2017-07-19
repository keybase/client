// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// BackgroundTask runs a function in the background once in a while.
// Note that this engine is long-lived and potentially has to deal with being
// logged out and logged in as a different user, etc.
// The timer uses the clock to sleep. So if there is a timezone change
// it will probably wake up early or sleep for the extra hours.

package engine

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

// Function to run periodically.
// The error is logged but otherwise ignored.
type TaskFunc func(g *libkb.GlobalContext, ectx *Context) error

type BackgroundTaskSettings struct {
	// Wait after starting the app
	Start time.Duration
	// When waking up on mobile lots of timers will go off at once. We wait an additional
	// delay so as not to add to that herd and slow down the mobile experience when opening the app.
	WakeUp time.Duration
	// Wait between runs
	Interval time.Duration
	// Time limit on each round
	Limit time.Duration
}

// BackgroundTask is an engine.
type BackgroundTask struct {
	libkb.Contextified
	sync.Mutex

	args *BackgroundTaskArgs

	shutdown bool
	// Function to cancel the background context.
	// Can be nil before RunEngine exits
	shutdownFunc context.CancelFunc
}

type BackgroundTaskArgs struct {
	Name     string
	F        TaskFunc
	Settings BackgroundTaskSettings

	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

// NewBackgroundTask creates a BackgroundTask engine.
func NewBackgroundTask(g *libkb.GlobalContext, args *BackgroundTaskArgs) *BackgroundTask {
	return &BackgroundTask{
		Contextified: libkb.NewContextified(g),
		args:         args,
		shutdownFunc: nil,
	}
}

// Name is the unique engine name.
func (e *BackgroundTask) Name() string {
	if e.args != nil {
		return fmt.Sprintf("BackgroundTask(%v)", e.args.Name)
	}
	return "BackgroundTask"
}

// GetPrereqs returns the engine prereqs.
func (e *BackgroundTask) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *BackgroundTask) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *BackgroundTask) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *BackgroundTask) Run(ectx *Context) (err error) {
	defer e.G().CTrace(ectx.GetNetContext(), e.Name(), func() error { return err })()

	// use a new background context with a saved cancel function
	ectx = ectx.WithNetContext(context.Background())
	ectx, cancel := ectx.WithCancel()

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
		err := e.loop(ectx)
		if err != nil {
			e.log(ectx.GetNetContext(), "loop error: %s", err)
		}
		cancel()
		e.meta("loop-exit")
	}()

	return nil
}

func (e *BackgroundTask) Shutdown() {
	e.Lock()
	defer e.Unlock()
	e.shutdown = true
	if e.shutdownFunc != nil {
		e.shutdownFunc()
	}
}

func (e *BackgroundTask) loop(ectx *Context) error {
	// wakeAt times are calculated before a meta before their corresponding sleep.
	// To avoid the race where the testing goroutine calls advance before
	// this routine decides when to wake up. That led to this routine never waking.
	wakeAt := e.G().Clock().Now().Add(e.args.Settings.Start)
	e.meta("loop-start")
	if err := libkb.SleepUntilWithContext(ectx.GetNetContext(), e.G().Clock(), wakeAt); err != nil {
		return err
	}
	e.meta("woke-start")
	var i int
	for {
		i++
		err := e.round(ectx)
		if err != nil {
			e.log(ectx.GetNetContext(), "round(%v) error: %s", i, err)
		} else {
			e.log(ectx.GetNetContext(), "round(%v) complete", i)
		}
		if e.args.testingRoundResCh != nil {
			e.args.testingRoundResCh <- err
		}
		wakeAt = e.G().Clock().Now().Add(e.args.Settings.Interval)
		e.meta("loop-round-complete")
		if err := libkb.SleepUntilWithContext(ectx.GetNetContext(), e.G().Clock(), wakeAt); err != nil {
			return err
		}
		wakeAt = e.G().Clock().Now().Add(e.args.Settings.WakeUp)
		e.meta("woke-interval")
		if err := libkb.SleepUntilWithContext(ectx.GetNetContext(), e.G().Clock(), wakeAt); err != nil {
			return err
		}
		e.meta("woke-wakeup")
	}
}

func (e *BackgroundTask) round(ectx *Context) error {
	ectx, cancel := ectx.WithTimeout(e.args.Settings.Limit)
	defer cancel()

	// Run the function.
	if e.args.F == nil {
		return fmt.Errorf("nil task function")
	}
	return e.args.F(e.G(), ectx)
}

func (e *BackgroundTask) meta(s string) {
	if e.args.testingMetaCh != nil {
		e.args.testingMetaCh <- s
	}
}

func (e *BackgroundTask) log(ctx context.Context, format string, args ...interface{}) {
	content := fmt.Sprintf(format, args...)
	e.G().Log.CDebugf(ctx, "%s %s", e.Name(), content)
}
