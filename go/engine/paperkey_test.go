// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func paperDevs(tc libkb.TestContext, fu *FakeUser) (*libkb.User, []*libkb.Device) {
	arg := libkb.NewLoadUserForceArg(tc.G).WithName(fu.Username)
	u, err := libkb.LoadUser(arg)
	require.NoError(tc.T, err)
	cki := u.GetComputedKeyInfos()
	require.NotNil(tc.T, cki)
	return u, cki.PaperDevices()
}

func hasZeroPaperDev(tc libkb.TestContext, fu *FakeUser) {
	_, bdevs := paperDevs(tc, fu)
	require.Equal(tc.T, 0, len(bdevs), "num backup devices")
}

func hasOnePaperDev(tc libkb.TestContext, fu *FakeUser) keybase1.DeviceID {
	u, bdevs := paperDevs(tc, fu)

	require.Equal(tc.T, 1, len(bdevs), "num backup devices")

	devid := bdevs[0].ID
	sibkey, err := u.GetComputedKeyFamily().GetSibkeyForDevice(devid)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, sibkey)

	enckey, err := u.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(devid)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, enckey)

	return devid
}

func TestPaperKey(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	fu, _, _ := CreateAndSignupFakeUserCustomArg(tc, "login", f)

	userDeviceID := tc.G.Env.GetDeviceID()

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	require.NotZero(t, len(eng.Passphrase()))
	Logout(tc)

	// check for the backup key
	devid := hasOnePaperDev(tc, fu)

	// ok, just log in again:
	err = fu.Login(tc.G)
	require.NoError(t, err)
	Logout(tc)

	// make sure the passphrase authentication didn't change:
	m = m.WithNewProvisionalLoginContext()
	err = libkb.PassphraseLoginNoPrompt(m, fu.Username, fu.Passphrase)
	require.NoError(t, err, "passphrase login still worked")
	m = m.CommitProvisionalLogin()

	// make sure the backup key device id is different than the actual device id
	// and that the actual device id didn't change.
	// (investigating bug theory)
	require.NotEqual(t, userDeviceID, devid)
	require.Equal(t, userDeviceID, tc.G.Env.GetDeviceID())
	require.NotEqual(t, tc.G.Env.GetDeviceID(), devid)
}

func TestPaperKeyMulti(t *testing.T) {
	testPaperKeyMulti(t, false)
}

func TestPaperKeyMultiPUK(t *testing.T) {
	testPaperKeyMulti(t, true)
}

// Generate multiple paper keys
func testPaperKeyMulti(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	fu, _, _ := CreateAndSignupFakeUserCustomArg(tc, "login", f)

	for i := 0; i < 3; i++ {
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
		require.NotZero(t, eng.Passphrase())

		// check for the backup key
		_, bdevs := paperDevs(tc, fu)
		require.Equal(tc.T, i+1, len(bdevs), "num backup devices")
	}
}

// tests revoking of existing backup keys
func TestPaperKeyRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{RevokeBackup: true},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	require.NotZero(t, len(eng.Passphrase()))

	// check for the backup key
	_, bdevs := paperDevs(tc, fu)
	require.Len(t, bdevs, 1)

	// generate another one, first should be revoked
	eng = NewPaperKey(tc.G)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	require.NotZero(t, len(eng.Passphrase()))

	// check for the backup key
	_, bdevs = paperDevs(tc, fu)
	require.Len(t, bdevs, 1)
}

// make a paperkey after revoking a previous one
func TestPaperKeyAfterRevokePUK(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	gen := func() {
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
		require.NotEqual(t, 0, len(eng.Passphrase()), "empty passphrase")
	}

	revoke := func(devid keybase1.DeviceID) {
		err := doRevokeDevice(tc, fu, devid, false /* force */, false /* forceLast */)
		require.NoError(t, err)
	}

	hasZeroPaperDev(tc, fu)
	gen()
	devid := hasOnePaperDev(tc, fu)
	revoke(devid)
	hasZeroPaperDev(tc, fu)
	gen()
	hasOnePaperDev(tc, fu)
}

// tests not revoking existing backup keys
func TestPaperKeyNoRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "login")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{RevokeBackup: false},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	require.NotZero(t, len(eng.Passphrase()))

	// check for the backup key
	_, bdevs := paperDevs(tc, fu)
	require.Len(t, bdevs, 2)

	// generate another one, first should be left alone
	eng = NewPaperKey(tc.G)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	require.NotZero(t, len(eng.Passphrase()))

	// check for the backup key
	_, bdevs = paperDevs(tc, fu)
	require.Len(t, bdevs, 3)
}

// Make sure PaperKeyGen uses the secret store.
func TestPaperKeyGenWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: secretUI,
		}
		eng := NewPaperKey(tc.G)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
	})
}
