// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func loginWithoutSignup(t *testing.T, tc libkb.TestContext, username libkb.NormalizedUsername) {
	require.NoError(t, tc.G.ActiveDevice.Clear())
	uid := libkb.UsernameToUID(username.String())
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
		keybase1.UserVersion{Uid: uid, EldestSeqno: 1}, deviceID, nil, nil, "testuser-mac", 0,
		libkb.KeychainModeNone))
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		libkb.NewUserConfig(uid, username, nil, deviceID), true))
}

func TestImportContactsEnabled(t *testing.T) {
	tc := libkb.SetupTest(t, "TestImportContactsEnabled", 1)
	defer tc.Cleanup()
	require.NoError(t, tc.G.ConfigureGUIConfig())
	mctx := libkb.NewMetaContextForTest(tc)

	_, err := ImportContactsEnabled(mctx)
	require.Error(t, err, "no logged-in user")
	require.Error(t, SetImportContactsEnabled(mctx, true))

	loginWithoutSignup(t, tc, "testuser")

	// never set reads as off, not as an error
	enabled, err := ImportContactsEnabled(mctx)
	require.NoError(t, err)
	require.False(t, enabled)

	// a value the app wrote before this RPC existed is still read
	require.NoError(t, tc.G.Env.GetGUIConfig().SetBoolAtPath("ui.importContacts.testuser", true))
	enabled, err = ImportContactsEnabled(mctx)
	require.NoError(t, err)
	require.True(t, enabled)

	require.NoError(t, SetImportContactsEnabled(mctx, false))
	enabled, err = ImportContactsEnabled(mctx)
	require.NoError(t, err)
	require.False(t, enabled)
	stored, isSet := tc.G.Env.GetGUIConfig().GetBoolAtPath("ui.importContacts.testuser")
	require.True(t, isSet)
	require.False(t, stored)

	// the setting is per user
	loginWithoutSignup(t, tc, "testuser2")
	require.NoError(t, SetImportContactsEnabled(mctx, true))
	loginWithoutSignup(t, tc, "testuser")
	enabled, err = ImportContactsEnabled(mctx)
	require.NoError(t, err)
	require.False(t, enabled)
}
