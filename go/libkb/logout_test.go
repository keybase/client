package libkb

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLogoutOnlyIfUID(t *testing.T) {
	tc := SetupTest(t, "logout", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	active := keybase1.UserVersion{Uid: keybase1.UID("295a7eea607af32040647123732bc819"), EldestSeqno: 1}
	activeDevice := keybase1.DeviceID("ad2ab7ef58db8e8e8b7c5d9f0d3d2b18")
	other := keybase1.UID("a8a1b4c0e8b9cf2c3a1c3e1f4d1e9819")
	otherDevice := keybase1.DeviceID("5b1a0d8f1c2e3d4a5b6c7d8e9f0a1b18")
	setActive := func() {
		tc.G.ActiveDevice.Lock()
		defer tc.G.ActiveDevice.Unlock()
		require.NoError(t, tc.G.ActiveDevice.internalUpdateUserVersionDeviceID(active, activeDevice))
	}

	setActive()
	err := m.LogoutUsernameWithOptions("testuser", LogoutOptions{Force: true, OnlyIfUID: other})
	require.ErrorIs(t, err, ErrLogoutUserChanged)
	require.Equal(t, active.Uid, tc.G.ActiveDevice.UID(), "a logout pinned to another user leaves the active one")

	err = m.LogoutUsernameWithOptions("testuser", LogoutOptions{Force: true, OnlyIfUID: active.Uid, OnlyIfDeviceID: otherDevice})
	require.ErrorIs(t, err, ErrLogoutUserChanged)
	require.Equal(t, active.Uid, tc.G.ActiveDevice.UID(), "a logout pinned to another device of the active user leaves it")

	err = m.LogoutUsernameWithOptions("testuser", LogoutOptions{Force: true, OnlyIfUID: active.Uid, OnlyIfDeviceID: activeDevice})
	require.NoError(t, err)
	require.True(t, tc.G.ActiveDevice.UID().IsNil(), "a logout pinned to the active device logs it out")
}
