// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"testing"

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

// Clients are told from the one place the value changes, so no writer can add a
// path that moves the state without announcing it. The announce is observable
// from here as the state version it stamps.
func TestMobileAppStateAnnouncesOnlyOnChange(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateAnnounce", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	a := NewMobileAppState(tc.G)

	before := tc.G.StateVersion()
	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	announced := tc.G.StateVersion()
	require.Equal(t, before.Counter+1, announced.Counter, "one stamp for the change")

	require.False(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	require.Equal(t, announced.Counter, tc.G.StateVersion().Counter, "nothing announced for a same-value update")

	require.True(t, a.Update(keybase1.MobileAppState_FOREGROUND))
	require.Equal(t, announced.Counter+1, tc.G.StateVersion().Counter)
}

// The stamp lands in the same critical section as the state write, so two
// concurrent Updates publish in the order they wrote rather than in whatever
// order they reached the router. Checked white-box: holding the lock across
// updateLocked is the only way to observe "has the version been stamped yet",
// and the answer must be yes before the lock is released.
func TestMobileAppStateStampsUnderTheLock(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateStamp", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	a := NewMobileAppState(tc.G)

	before := tc.G.StateVersion().Counter
	a.Lock()
	changed := a.updateLocked(keybase1.MobileAppState_BACKGROUND)
	stamped := tc.G.StateVersion().Counter
	a.Unlock()

	require.True(t, changed)
	require.Equal(t, before+1, stamped,
		"the change was announced before the lock that wrote it was released")
}
