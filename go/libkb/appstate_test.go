// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"sync"
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
		waiters    = 8
		iterations = 300
	)

	var (
		waitersWG sync.WaitGroup
		writersWG sync.WaitGroup
	)

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
			}
		}(i)
	}

	requireDoneWithin(t, &writersWG, 30*time.Second, "writers deadlocked")

	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUNDACTIVE))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, a.State())
	requireDoneWithin(t, &waitersWG, 30*time.Second, "a NextUpdate waiter missed the final change")
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
