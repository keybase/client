// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycle_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func newAppState(t *testing.T) (*libkb.MobileAppState, *libkb.GlobalContext) {
	tc := libkb.SetupTest(t, strings.ReplaceAll(t.Name(), "/", "_"), 0)
	t.Cleanup(tc.Cleanup)
	return libkb.NewMobileAppState(tc.G), tc.G
}

// Each scenario runs against a real MobileAppState. Besides the harness's
// per-step checks, live RPCs must be canceled exactly on a real change into
// BACKGROUND, the one state that tears down network and servers.
func TestScenarios(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			appState, g := newAppState(t)
			h := lifecycletest.NewHarness(t, appState, sc.Platform)
			defer h.Close()
			for _, step := range sc.Steps {
				before := appState.State()
				ctx, key := g.RPCCanceler.RegisterContext(context.Background(), libkb.RPCCancelerReasonBackground)
				h.Do(step)
				canceled := ctx.Err() != nil
				g.RPCCanceler.UnregisterContext(key)
				wantCancel := step.Want == keybase1.MobileAppState_BACKGROUND && before != keybase1.MobileAppState_BACKGROUND
				require.Equal(t, wantCancel, canceled, "%v: RPC cancel", step.Do)
			}
			h.CheckObserved(sc.Observed)
			teardowns := 0
			for _, s := range sc.Observed[1:] {
				if s == keybase1.MobileAppState_BACKGROUND {
					teardowns++
				}
			}
			require.Equal(t, teardowns, h.Recorder.Teardowns())
		})
	}
}

// Play is what consumer tests use; make sure it runs the same checks.
func TestPlay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			appState, _ := newAppState(t)
			steps := 0
			lifecycletest.Play(t, appState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				require.Equal(t, step.Want, h.Recorder.Last())
				steps++
			})
			require.Equal(t, len(sc.Steps), steps)
		})
	}
}

// A scenario that fails midway must not hang in Close on work still waiting
// on the fake clock or on deliveries.
func TestHarnessCloseEndsRunningWork(t *testing.T) {
	const bga = keybase1.MobileAppState_BACKGROUNDACTIVE
	cases := map[string][]lifecycletest.Step{
		"background sync": {
			{Do: lifecycletest.BackgroundSyncStart, Want: bga, Gen: 1, Returns: lifecycletest.ReturnTrue},
		},
		"background task": {
			{Do: lifecycletest.WorkStarts, Want: keybase1.MobileAppState_BACKGROUND},
			{Do: lifecycletest.DidEnterBackground, Want: bga, Gen: 1, Flush: true, Returns: lifecycletest.ReturnTrue},
			{Do: lifecycletest.BackgroundTaskStart, Want: bga, Returns: lifecycletest.ReturnTrue},
		},
	}
	for name, steps := range cases {
		t.Run(name, func(t *testing.T) {
			appState, _ := newAppState(t)
			h := lifecycletest.NewHarness(t, appState, lifecycletest.IOS)
			for _, step := range steps {
				h.Do(step)
			}
			closed := make(chan struct{})
			go func() {
				h.Close()
				close(closed)
			}()
			select {
			case <-closed:
			case <-time.After(5 * time.Second):
				require.Fail(t, "Close hung")
			}
		})
	}
}
