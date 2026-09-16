// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestUpdateAppStateAndFlushOnlyOnChange(t *testing.T) {
	tc := libkb.SetupTest(t, "UpdateAppStateAndFlush", 0)
	defer tc.Cleanup()
	appState := libkb.NewMobileAppState(tc.G)

	flushes := 0
	flush := func() { flushes++ }

	updateAppStateAndFlush(appState, keybase1.MobileAppState_BACKGROUND, flush)
	require.Equal(t, 1, flushes)
	_, gen := appState.StateAndGeneration()

	updateAppStateAndFlush(appState, keybase1.MobileAppState_BACKGROUND, flush)
	require.Equal(t, 1, flushes, "a repeated BACKGROUND must not flush again")
	_, gen2 := appState.StateAndGeneration()
	require.Greater(t, gen2, gen)

	appState.Update(keybase1.MobileAppState_FOREGROUND)
	updateAppStateAndFlush(appState, keybase1.MobileAppState_BACKGROUNDACTIVE, flush)
	require.Equal(t, 2, flushes)
	updateAppStateAndFlush(appState, keybase1.MobileAppState_BACKGROUNDACTIVE, flush)
	require.Equal(t, 2, flushes)
}
