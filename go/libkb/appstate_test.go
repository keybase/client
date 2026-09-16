// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func requireClosed(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	default:
		require.Fail(t, "expected channel to be closed")
	}
}

func requireOpen(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
		require.Fail(t, "expected channel to be open")
	default:
	}
}

func TestMobileAppStateInitialState(t *testing.T) {
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, initialMobileAppState("ios"))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, initialMobileAppState("android"))
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, initialMobileAppState("darwin"))
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, initialMobileAppState("linux"))
}

func TestMobileAppStateGeneration(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateGeneration", 0)
	defer tc.Cleanup()
	a := NewMobileAppState(tc.G)

	state, gen := a.StateAndGeneration()
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, state)

	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUNDACTIVE))
	state, gen1 := a.StateAndGeneration()
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, state)
	require.Greater(t, gen1, gen)

	// A same-value update is accepted and bumps the generation.
	require.False(t, a.Update(keybase1.MobileAppState_BACKGROUNDACTIVE))
	state, gen2 := a.StateAndGeneration()
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, state)
	require.Greater(t, gen2, gen1)

	// A CAS against the generation read before that same-value update fails.
	newGen, applied, changed := a.UpdateIfGeneration(gen1, keybase1.MobileAppState_BACKGROUND)
	require.False(t, applied)
	require.False(t, changed)
	require.Equal(t, gen2, newGen)
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, a.State())

	// A CAS against the current generation applies.
	newGen, applied, changed = a.UpdateIfGeneration(gen2, keybase1.MobileAppState_BACKGROUND)
	require.True(t, applied)
	require.True(t, changed)
	state, gen3 := a.StateAndGeneration()
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, state)
	require.Equal(t, gen3, newGen)
	require.Greater(t, gen3, gen2)

	// A same-value CAS applies, bumps the generation, and reports no change.
	newGen, applied, changed = a.UpdateIfGeneration(gen3, keybase1.MobileAppState_BACKGROUND)
	require.True(t, applied)
	require.False(t, changed)
	require.Greater(t, newGen, gen3)
}

func TestMobileAppStateSideEffectsOnlyOnChange(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateSideEffects", 0)
	defer tc.Cleanup()
	a := NewMobileAppState(tc.G)

	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	_, mtime := a.StateAndMtime()
	require.NotNil(t, mtime)

	next := a.NextUpdate(keybase1.MobileAppState_BACKGROUND)
	require.False(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	requireOpen(t, next)
	_, mtime2 := a.StateAndMtime()
	require.Same(t, mtime, mtime2)

	_, gen := a.StateAndGeneration()
	_, _, _ = a.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUND)
	requireOpen(t, next)

	// A stale lastState wakes immediately.
	requireClosed(t, a.NextUpdate(keybase1.MobileAppState_FOREGROUND))

	require.True(t, a.Update(keybase1.MobileAppState_FOREGROUND))
	requireClosed(t, next)
}

func TestMobileAppStateBackgroundCancelsRPCsOnlyOnChange(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateCancel", 0)
	defer tc.Cleanup()
	a := NewMobileAppState(tc.G)

	register := func() context.Context {
		ctx, _ := tc.G.RPCCanceler.RegisterContext(context.Background(), RPCCancelerReasonBackground)
		return ctx
	}

	first := register()
	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	requireClosed(t, first.Done())

	second := register()
	require.False(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	requireOpen(t, second.Done())
}

func TestMobileAppStateStress(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateStress", 0)
	defer tc.Cleanup()
	a := NewMobileAppState(tc.G)

	// Writers never set BACKGROUNDACTIVE; it marks the end for waiters.
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
	}
	const (
		writers    = 8
		casWriters = 8
		waiters    = 8
		iterations = 300
	)
	_, startGen := a.StateAndGeneration()

	var (
		accepted  atomic.Uint64
		waitersWG sync.WaitGroup
		writersWG sync.WaitGroup
	)
	errs := make(chan string, casWriters*iterations)

	for i := 0; i < waiters; i++ {
		waitersWG.Add(1)
		go func() {
			defer waitersWG.Done()
			for {
				s := a.State()
				if s == keybase1.MobileAppState_BACKGROUNDACTIVE {
					return
				}
				<-a.NextUpdate(s)
			}
		}()
	}

	for i := 0; i < writers; i++ {
		writersWG.Add(1)
		go func(i int) {
			defer writersWG.Done()
			for j := 0; j < iterations; j++ {
				a.Update(states[(i+j)%len(states)])
				accepted.Add(1)
			}
		}(i)
	}

	for i := 0; i < casWriters; i++ {
		writersWG.Add(1)
		go func(i int) {
			defer writersWG.Done()
			for j := 0; j < iterations; j++ {
				next := states[(i+j)%len(states)]
				if j%2 == 0 {
					// Our own update in between makes gen stale, whatever else runs.
					_, gen := a.StateAndGeneration()
					a.Update(next)
					accepted.Add(1)
					if _, applied, _ := a.UpdateIfGeneration(gen, next); applied {
						errs <- "a CAS with a stale generation applied"
					}
					continue
				}
				_, gen := a.StateAndGeneration()
				newGen, applied, _ := a.UpdateIfGeneration(gen, next)
				if applied {
					accepted.Add(1)
					if newGen != gen+1 {
						errs <- "an applied CAS did not advance the generation by one"
					}
				} else if newGen <= gen {
					errs <- "a rejected CAS reported a generation that did not move"
				}
			}
		}(i)
	}

	requireDoneWithin(t, &writersWG, 30*time.Second, "writers deadlocked")

	_, gen := a.StateAndGeneration()
	require.Equal(t, startGen+accepted.Load(), gen, "every accepted update bumps the generation exactly once")

	// A CAS on the current generation applies and is the last update, so it
	// must be the final state.
	newGen, applied, _ := a.UpdateIfGeneration(gen, keybase1.MobileAppState_BACKGROUNDACTIVE)
	require.True(t, applied)
	state, finalGen := a.StateAndGeneration()
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, state)
	require.Equal(t, newGen, finalGen)

	requireDoneWithin(t, &waitersWG, 30*time.Second, "a NextUpdate waiter missed the final change")
	close(errs)
	for err := range errs {
		require.Fail(t, err)
	}
}

func requireDoneWithin(t *testing.T, wg *sync.WaitGroup, timeout time.Duration, msg string) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
		require.Fail(t, msg)
	}
}
