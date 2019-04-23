// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Test logging in with paper key when
// loggedin: true
// unlocked: true
// Does not ask for anything.
func TestLoginWithPaperKeyAlreadyIn(t *testing.T) {
	tc := SetupEngineTest(t, "loginwithpaperkey")
	defer tc.Cleanup()
	_, paperkey := CreateAndSignupLPK(tc, "login")

	t.Logf("checking logged in status [before]")
	AssertLoggedInLPK(&tc, true)
	t.Logf("checking unlocked status [before]")
	AssertDeviceKeysLock(&tc, true)

	t.Logf("running LoginWithPaperKey")
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
		SecretUI: &TestSecretUIPaperKey{
			T:                         t,
			Paperkey:                  paperkey,
			AllowedGetPassphraseCalls: 0,
		},
	}
	eng := NewLoginWithPaperKey(tc.G, "")
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("checking logged in status [after]")
	AssertLoggedInLPK(&tc, true)
	t.Logf("checking unlocked status [after]")
	AssertDeviceKeysLock(&tc, true)
}

// Test logging in with paper key when
// loggedin: false
// unlocked: false
// Asks for a paperky.
func TestLoginWithPaperKeyFromScratch(t *testing.T) {
	tc := SetupEngineTest(t, "loginwithpaperkey")
	defer tc.Cleanup()
	_, paperkey := CreateAndSignupLPK(tc, "login")

	t.Logf("logging out")
	Logout(tc)

	t.Logf("checking logged in status [before]")
	AssertLoggedInLPK(&tc, false)
	t.Logf("checking unlocked status [before]")
	AssertDeviceKeysLock(&tc, false)

	t.Logf("running LoginWithPaperKey")
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
		SecretUI: &TestSecretUIPaperKey{
			T:                         t,
			Paperkey:                  paperkey,
			AllowedGetPassphraseCalls: 1,
		},
	}
	eng := NewLoginWithPaperKey(tc.G, "")
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("checking logged in status [after]")
	AssertLoggedInLPK(&tc, true)
	t.Logf("checking unlocked status [after]")
	AssertDeviceKeysLock(&tc, true)
}

// Test logging in with paper key when
// loggedin: true
// unlocked: false
// Asks for a paperkey.
func TestLoginWithPaperKeyLoggedInAndLocked(t *testing.T) {
	tc := SetupEngineTest(t, "loginwithpaperkey")
	defer tc.Cleanup()
	u, paperkey := CreateAndSignupLPK(tc, "login")

	t.Logf("locking keys")
	tc.SimulateServiceRestart()
	err := tc.G.SecretStore().ClearSecret(NewMetaContextForTest(tc), libkb.NormalizedUsername(u.Username))
	require.NoError(t, err)

	t.Logf("checking logged in status [before]")
	AssertLoggedInLPK(&tc, false)
	t.Logf("checking unlocked status [before]")
	AssertDeviceKeysLock(&tc, false)

	t.Logf("running LoginWithPaperKey")
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
		SecretUI: &TestSecretUIPaperKey{
			T:                         t,
			Paperkey:                  paperkey,
			AllowedGetPassphraseCalls: 1,
		},
	}
	eng := NewLoginWithPaperKey(tc.G, "")
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("checking logged in status [after]")
	AssertLoggedInLPK(&tc, true)
	t.Logf("checking unlocked status [after]")
	AssertDeviceKeysLock(&tc, true)
}

// full flow, login with username
func TestLoginWithPaperKeyByUsername(t *testing.T) {
	tc := SetupEngineTest(t, "loginwithpaperkey")
	defer tc.Cleanup()
	fu, paperkey := CreateAndSignupLPK(tc, "login")

	t.Logf("logging out")
	Logout(tc)

	t.Logf("checking logged in status [before]")
	AssertLoggedInLPK(&tc, false)
	t.Logf("checking unlocked status [before]")
	AssertDeviceKeysLock(&tc, false)

	t.Logf("running LoginWithPaperKey")
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
		SecretUI: &TestSecretUIPaperKey{
			T:                         t,
			Paperkey:                  paperkey,
			AllowedGetPassphraseCalls: 1,
		},
	}
	eng := NewLoginWithPaperKey(tc.G, fu.NormalizedUsername().String())
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("checking logged in status [after]")
	AssertLoggedInLPK(&tc, true)
	t.Logf("checking unlocked status [after]")
	AssertDeviceKeysLock(&tc, true)
}

// full flow, fail to login due to an invalid username
func TestLoginWithInvalidUsername(t *testing.T) {
	tc := SetupEngineTest(t, "loginwithpaperkey")
	defer tc.Cleanup()

	// We're creating the user to make sure that we have _some_ keys
	// and differentiate from the no-username-passed flow
	_, paperkey := CreateAndSignupLPK(tc, "login")

	t.Logf("logging out")
	Logout(tc)

	t.Logf("checking logged in status [before]")
	AssertLoggedInLPK(&tc, false)
	t.Logf("checking unlocked status [before]")
	AssertDeviceKeysLock(&tc, false)

	t.Logf("running LoginWithPaperKey")
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
		SecretUI: &TestSecretUIPaperKey{
			T:                         t,
			Paperkey:                  paperkey,
			AllowedGetPassphraseCalls: 1,
		},
	}
	eng := NewLoginWithPaperKey(tc.G, "doesnotexist")
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.Equal(t, libkb.NotFoundError{}, err)

	t.Logf("checking logged in status [after]")
	AssertLoggedInLPK(&tc, false)
	t.Logf("checking unlocked status [after]")
	AssertDeviceKeysLock(&tc, false)
}

// Returns the user and paper key.
func CreateAndSignupLPK(tc libkb.TestContext, prefix string) (*FakeUser, string) {
	u := CreateAndSignupFakeUser(tc, prefix)

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		tc.T.Fatal(err)
	}

	backupPassphrase := beng.Passphrase()

	return u, backupPassphrase
}

func AssertLoggedInLPK(tc *libkb.TestContext, shouldBeLoggedIn bool) {
	activeDeviceIsValid := tc.G.ActiveDevice.Valid()
	t := tc.T
	if shouldBeLoggedIn {
		require.Equal(t, true, activeDeviceIsValid, "user should be logged in")
	} else {
		require.Equal(t, false, activeDeviceIsValid, "user should not be logged in")
	}
}

func AssertDeviceKeysLock(tc *libkb.TestContext, shouldBeUnlocked bool) {
	_, _, _, sk, ek := tc.G.ActiveDevice.AllFields()

	if shouldBeUnlocked {
		require.NotNil(tc.T, sk, "device signing key should be available")
		require.NotNil(tc.T, ek, "device encryption key should be available")
	} else {
		require.Nil(tc.T, sk, "device signing key should be unavailable")
		require.Nil(tc.T, ek, "device encryption key should be unavailable")
	}
}

type TestSecretUIPaperKey struct {
	T                         *testing.T
	Paperkey                  string
	AllowedGetPassphraseCalls int
	nGetPassphraseCalls       int
}

func (t *TestSecretUIPaperKey) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	require.Equal(t.T, keybase1.PassphraseType_PAPER_KEY, p.Type, "TestSecretUIPaperKey prompted for non-paperkey")
	t.nGetPassphraseCalls++
	require.True(t.T, t.nGetPassphraseCalls <= t.AllowedGetPassphraseCalls, "GetPassphrase called too many times on paperkey")
	return keybase1.GetPassphraseRes{
		Passphrase: t.Paperkey,
		// What's this?
		StoreSecret: false,
	}, nil
}
