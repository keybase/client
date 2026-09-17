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
