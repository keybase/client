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
	arg := libkb.NewLoadUserForceArg(tc.G)
	arg.Name = fu.Username
	u, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal(err)
	}
	cki := u.GetComputedKeyInfos()
	if cki == nil {
		tc.T.Fatal("no computed key infos")
	}
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
	if err != nil {
		tc.T.Fatal(err)
	}
	if sibkey == nil {
		tc.T.Fatal("nil backup sibkey")
	}
	enckey, err := u.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(devid)
	if err != nil {
		tc.T.Fatal(err)
	}
	if enckey == nil {
		tc.T.Fatal("nil backup enckey")
	}

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

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPaperKey(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}
	Logout(tc)

	// check for the backup key
	devid := hasOnePaperDev(tc, fu)

	// ok, just log in again:
	if err := fu.Login(tc.G); err != nil {
		t.Errorf("after backup key gen, login failed: %s", err)
	}
	Logout(tc)

	// make sure the passphrase authentication didn't change:

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(fu.Passphrase)
	if err != nil {
		t.Fatal(err)
	}

	// make sure the backup key device id is different than the actual device id
	// and that the actual device id didn't change.
	// (investigating bug theory)
	if userDeviceID == devid {
		t.Errorf("user's device id before backup key gen (%s) matches backup key device id (%s).  They shouuld be different.", userDeviceID, devid)
	}
	if userDeviceID != tc.G.Env.GetDeviceID() {
		t.Errorf("user device id changed.  start = %s, post-backup = %s", userDeviceID, tc.G.Env.GetDeviceID())
	}
	if tc.G.Env.GetDeviceID() == devid {
		t.Errorf("current device id (%s) matches backup key device id (%s).  They should be different.", tc.G.Env.GetDeviceID(), devid)
	}
}

func TestPaperKeyMulti(t *testing.T) {
	testPaperKeyMulti(t, false)
}

func TestPaperKeyMultiSDH(t *testing.T) {
	testPaperKeyMulti(t, true)
}

// Generate multiple paper keys
func testPaperKeyMulti(t *testing.T, enableSharedDH bool) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()
	tc.Tp.EnableSharedDH = enableSharedDH

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	fu, _, _ := CreateAndSignupFakeUserCustomArg(tc, "login", f)

	for i := 0; i < 3; i++ {
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}
		if len(eng.Passphrase()) == 0 {
			t.Fatal("empty passphrase")
		}

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

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{RevokeBackup: true},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewPaperKey(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs := paperDevs(tc, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}

	// generate another one, first should be revoked
	eng = NewPaperKey(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs = paperDevs(tc, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}
}

// make a paperkey after revoking a previous one
func TestPaperKeyAfterRevokeSDH(t *testing.T) {
	t.Skip("TODO waiting for CORE-4895 RevokePUK")

	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()
	tc.Tp.EnableSharedDH = true

	fu := CreateAndSignupFakeUser(tc, "login")

	gen := func() {
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		err := RunEngine(eng, ctx)
		require.NoError(t, err)
		require.NotEqual(t, 0, len(eng.Passphrase()), "empty passphrase")
	}

	revoke := func(devid keybase1.DeviceID) {
		err := doRevokeDevice(tc, fu, devid, false)
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

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{RevokeBackup: false},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewPaperKey(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs := paperDevs(tc, fu)
	if len(bdevs) != 2 {
		t.Errorf("num backup devices: %d, expected 2", len(bdevs))
	}

	// generate another one, first should be left alone
	eng = NewPaperKey(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs = paperDevs(tc, fu)
	if len(bdevs) != 3 {
		t.Errorf("num backup devices: %d, expected 3", len(bdevs))
	}
}

// Make sure PaperKeyGen uses the secret store.
func TestPaperKeyGenWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: secretUI,
		}
		eng := NewPaperKey(tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}
	})
}
