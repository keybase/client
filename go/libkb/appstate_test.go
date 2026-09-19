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
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, initialMobileAppState("android"))
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

func appStateChanges(t *testing.T, rec *NotifyRecorder) []keybase1.MobileAppState {
	t.Helper()
	var ret []keybase1.MobileAppState
	for _, m := range rec.Messages() {
		if m.Method != "keybase.1.NotifyApp.mobileAppStateChanged" {
			continue
		}
		var arg keybase1.MobileAppStateChangedArg
		require.NoError(t, m.Decode(&arg))
		ret = append(ret, arg.State)
	}
	return ret
}

// Clients are told from the one place the value changes, so no writer can add a
// path that moves the state without announcing it.
func TestMobileAppStateAnnouncesOnlyOnChange(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateAnnounce", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	a := NewMobileAppState(tc.G)
	rec := NewNotifyRecorder(tc.G, keybase1.NotificationChannels{App: true})
	defer rec.Close()

	require.True(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	require.False(t, a.Update(keybase1.MobileAppState_BACKGROUND))
	require.True(t, a.Update(keybase1.MobileAppState_FOREGROUND))
	rec.Flush()
	require.Equal(t, []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_FOREGROUND,
	}, appStateChanges(t, rec), "one notification per change, none for a same-value update")
}

// The notification is queued in the same critical section that wrote the
// state, so two concurrent Updates queue in the order they wrote rather than in
// whatever order they reached the router. Checked white-box: holding the lock
// across updateLocked is the only way to observe "has it been queued yet", and
// the answer must be yes before the lock is released.
func TestMobileAppStateQueuesUnderTheLock(t *testing.T) {
	tc := SetupTest(t, "MobileAppStateQueue", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	a := NewMobileAppState(tc.G)
	rec := NewNotifyRecorder(tc.G, keybase1.NotificationChannels{App: true})
	defer rec.Close()

	a.Lock()
	changed := a.updateLocked(keybase1.MobileAppState_BACKGROUND)
	// nothing queued reads app state (there is no clientState reader here), so
	// flushing under the lock cannot deadlock
	rec.Flush()
	queued := appStateChanges(t, rec)
	a.Unlock()

	require.True(t, changed)
	require.Equal(t, []keybase1.MobileAppState{keybase1.MobileAppState_BACKGROUND}, queued,
		"the change was queued before the lock that wrote it was released")
}
