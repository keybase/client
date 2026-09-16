package maps

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestBackgroundActiveOwner(t *testing.T) {
	tc := libkb.SetupTest(t, "BackgroundActiveOwner", 0)
	defer tc.Cleanup()
	appState := libkb.NewMobileAppState(tc.G)
	var owner backgroundActiveOwner

	// Only a move out of BACKGROUND is claimed.
	owner.claim(appState)
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, appState.State())
	owner.release(appState)
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, appState.State())

	appState.Update(keybase1.MobileAppState_BACKGROUND)
	owner.claim(appState)
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
	// Repeated location updates while already BACKGROUNDACTIVE keep the claim.
	owner.claim(appState)
	owner.release(appState)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())
}

func TestBackgroundActiveOwnerReleaseAfterForeground(t *testing.T) {
	tc := libkb.SetupTest(t, "BackgroundActiveOwnerForeground", 0)
	defer tc.Cleanup()
	appState := libkb.NewMobileAppState(tc.G)
	var owner backgroundActiveOwner

	appState.Update(keybase1.MobileAppState_BACKGROUND)
	owner.claim(appState)
	appState.Update(keybase1.MobileAppState_FOREGROUND)
	owner.release(appState)
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, appState.State())

	// Back in the background, someone else set BACKGROUNDACTIVE after the
	// claim; ending tracking leaves it alone.
	appState.Update(keybase1.MobileAppState_BACKGROUND)
	owner.claim(appState)
	appState.Update(keybase1.MobileAppState_FOREGROUND)
	appState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	owner.release(appState)
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
}
