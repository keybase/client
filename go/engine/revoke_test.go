// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func getActiveDevicesAndKeys(tc libkb.TestContext, u *FakeUser) ([]*libkb.Device, []libkb.GenericKey) {
	arg := libkb.NewLoadUserByNameArg(tc.G, u.Username).WithPublicKeyOptional()
	user, err := libkb.LoadUser(arg)
	require.NoError(tc.T, err)

	sibkeys := user.GetComputedKeyFamily().GetAllActiveSibkeys()
	subkeys := user.GetComputedKeyFamily().GetAllActiveSubkeys()

	activeDevices := []*libkb.Device{}
	for _, device := range user.GetComputedKeyFamily().GetAllDevices() {
		if device.Status != nil && *device.Status == libkb.DeviceStatusActive {
			activeDevices = append(activeDevices, device)
		}
	}
	return activeDevices, append(sibkeys, subkeys...)
}

func doRevokeKey(tc libkb.TestContext, u *FakeUser, kid keybase1.KID) error {
	revokeEngine := NewRevokeKeyEngine(tc.G, kid)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, revokeEngine)
	return err
}

func doRevokeDevice(tc libkb.TestContext, u *FakeUser, id keybase1.DeviceID, forceSelf, forceLast bool) error {
	revokeEngine := NewRevokeDeviceEngine(tc.G, RevokeDeviceEngineArgs{ID: id, ForceSelf: forceSelf, ForceLast: forceLast})
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, revokeEngine)
	return err
}

func assertNumDevicesAndKeys(tc libkb.TestContext, u *FakeUser, numDevices, numKeys int) {
	devices, keys := getActiveDevicesAndKeys(tc, u)
	if len(devices) != numDevices {
		for i, d := range devices {
			tc.T.Logf("device %d: %+v", i, d)
		}
		require.Fail(tc.T, fmt.Sprintf("Expected to find %d devices. Found %d.", numDevices, len(devices)))
	}
	if len(keys) != numKeys {
		for i, k := range keys {
			tc.T.Logf("key %d: %+v", i, k)
		}
		require.Fail(tc.T, fmt.Sprintf("Expected to find %d keys. Found %d.", numKeys, len(keys)))
	}
}

func TestRevokeDevice(t *testing.T) {
	testRevokeDevice(t, false)
}

func TestRevokeDevicePUK(t *testing.T) {
	testRevokeDevice(t, true)
}

func testRevokeDevice(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	u := CreateAndSignupFakeUserPaper(tc, "rev")

	assertNumDevicesAndKeys(tc, u, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, u)
	var thisDevice *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper {
			thisDevice = device
		}
	}

	// Revoking the current device should fail.
	err := doRevokeDevice(tc, u, thisDevice.ID, false, false)
	if err == nil {
		tc.T.Fatal("Expected revoking the current device to fail.")
	}

	assertNumDevicesAndKeys(tc, u, 2, 4)

	// But it should succeed with the --force flag.
	err = doRevokeDevice(tc, u, thisDevice.ID, true, false)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, u, 1, 2)
}

func TestRevokePaperDevice(t *testing.T) {
	testRevokePaperDevice(t, false)
}

func TestRevokePaperDevicePUK(t *testing.T) {
	testRevokePaperDevice(t, true)
}

func testRevokePaperDevice(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	u := CreateAndSignupFakeUserPaper(tc, "rev")

	t.Logf("username: %s", u.Username)

	assertNumDevicesAndKeys(tc, u, 2, 4)

	assertNumDevicesAndKeys(tc, u, 2, 4)

	revokeAnyPaperKey(tc, u)

	assertNumDevicesAndKeys(tc, u, 1, 2)

	if tc.G.Env.GetUpgradePerUserKey() {
		checkPerUserKeyring(t, tc.G, 2)
	} else {
		checkPerUserKeyring(t, tc.G, 0)
	}

	arg := libkb.NewLoadUserByNameArg(tc.G, u.Username)
	user, err := libkb.LoadUser(arg)
	require.NoError(t, err)

	var nextSeqno int
	var postedSeqno int
	if upgradePerUserKey {
		nextSeqno = 7
		postedSeqno = 4
	} else {
		nextSeqno = 5
		postedSeqno = 3
	}
	nextExpected, err := user.GetExpectedNextHPrevInfo()
	require.NoError(t, err)
	require.Equal(t, nextExpected.Seqno, keybase1.Seqno(nextSeqno))
	assertPostedHighSkipSeqno(t, tc, user.GetName(), postedSeqno)
}

func TestRevokerPaperDeviceTwice(t *testing.T) {
	testRevokerPaperDeviceTwice(t, false)
}

func TestRevokerPaperDeviceTwicePUK(t *testing.T) {
	testRevokerPaperDeviceTwice(t, true)
}

func testRevokerPaperDeviceTwice(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	u := CreateAndSignupFakeUserPaper(tc, "rev")

	t.Logf("username: %s", u.Username)

	t.Logf("generate second paper key")
	{
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

	t.Logf("check")
	assertNumDevicesAndKeys(tc, u, 3, 6)

	t.Logf("revoke paper key 1")
	revokeAnyPaperKey(tc, u)

	t.Logf("revoke paper key 2")
	revokeAnyPaperKey(tc, u)

	t.Logf("check")
	assertNumDevicesAndKeys(tc, u, 1, 2)

	if tc.G.Env.GetUpgradePerUserKey() {
		checkPerUserKeyring(t, tc.G, 3)
	}
}

func checkPerUserKeyring(t *testing.T, g *libkb.GlobalContext, expectedCurrentGeneration int) {
	pukring, err := g.GetPerUserKeyring()
	require.NoError(t, err)
	// Weakly check. If the keyring was not initialized, don't worry about it.
	if pukring.HasAnyKeys() == (expectedCurrentGeneration > 0) {
		require.Equal(t, keybase1.PerUserKeyGeneration(expectedCurrentGeneration), pukring.CurrentGeneration())
	}
	pukring = nil

	// double check that the per-user-keyring is correct
	g.ClearPerUserKeyring()
	pukring, err = g.GetPerUserKeyring()
	require.NoError(t, err)
	require.NoError(t, pukring.Sync(libkb.NewMetaContextTODO(g)))
	require.Equal(t, keybase1.PerUserKeyGeneration(expectedCurrentGeneration), pukring.CurrentGeneration())
}

func TestRevokeKey(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkeyPaper(tc)

	assertNumDevicesAndKeys(tc, u, 2, 5)

	_, keys := getActiveDevicesAndKeys(tc, u)
	var pgpKey *libkb.GenericKey
	for i, key := range keys {
		if libkb.IsPGP(key) {
			// XXX: Don't use &key. That refers to the loop variable, which
			// gets overwritten.
			pgpKey = &keys[i] //
			break
		}
	}
	if pgpKey == nil {
		t.Fatal("Expected to find PGP key")
	}

	err := doRevokeKey(tc, u, (*pgpKey).GetKID())
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, u, 2, 4)
}

// See issue #370.
func TestTrackAfterRevoke(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testTrackAfterRevoke(t, sigVersion)
	})
}

func _testTrackAfterRevoke(t *testing.T, sigVersion libkb.SigVersion) {
	tc1 := SetupEngineTest(t, "rev")
	defer tc1.Cleanup()

	// We need two devices. Use a paperkey to sign into the second device.

	// Sign up on tc1:
	u := CreateAndSignupFakeUserGPG(tc1, "pgp")

	t.Logf("create a paperkey")
	beng := NewPaperKey(tc1.G)
	uis := libkb.UIs{
		LogUI:    tc1.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	m := NewMetaContextForTest(tc1).WithUIs(uis)
	err := RunEngine2(m, beng)
	require.NoError(t, err)
	paperkey := beng.Passphrase()

	// Redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// Login on device tc2 using the paperkey.
	t.Logf("running LoginWithPaperKey")
	secUI := u.NewSecretUI()
	secUI.Passphrase = paperkey
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: u.Username}
	uis = libkb.UIs{
		ProvisionUI: provUI,
		LogUI:       tc2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc2.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	m = NewMetaContextForTest(tc2).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("tc2 revokes tc1 device:")
	err = doRevokeDevice(tc2, u, tc1.G.Env.GetDeviceID(), false, false)
	require.NoError(t, err)

	// Still logged in on tc1.  Try to use it to track someone.  It should fail
	// with a KeyRevokedError.
	_, _, err = runTrack(tc1, u, "t_alice", sigVersion)
	if err == nil {
		t.Fatal("expected runTrack to return an error")
	}
	if _, ok := err.(libkb.BadSessionError); !ok {
		t.Errorf("expected libkb.BadSessionError, got %T", err)
	}
}

func TestSignAfterRevoke(t *testing.T) {
	tc1 := SetupEngineTest(t, "rev")
	defer tc1.Cleanup()

	// We need two devices. Use a paperkey to sign into the second device.

	// Sign up on tc1:
	u := CreateAndSignupFakeUserGPG(tc1, "pgp")

	t.Logf("create a paperkey")
	beng := NewPaperKey(tc1.G)
	uis := libkb.UIs{
		LogUI:    tc1.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	m := NewMetaContextForTest(tc1).WithUIs(uis)
	err := RunEngine2(m, beng)
	require.NoError(t, err)
	paperkey := beng.Passphrase()

	// Redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// Login on device tc2 using the paperkey.
	t.Logf("running LoginWithPaperKey")
	secUI := u.NewSecretUI()
	secUI.Passphrase = paperkey
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: u.Username}
	uis = libkb.UIs{
		ProvisionUI: provUI,
		LogUI:       tc2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc2.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	m = NewMetaContextForTest(tc2).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	t.Logf("tc2 revokes tc1 device:")
	err = doRevokeDevice(tc2, u, tc1.G.Env.GetDeviceID(), false, false)
	require.NoError(t, err)

	// Still logged in on tc1, a revoked device.

	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}
	// Test signing with (revoked) device key on tc1, which works...
	msg := []byte("test message")
	ret, err := SignED25519(context.TODO(), tc1.G, f, keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}
	publicKey := libkb.NaclSigningKeyPublic(ret.PublicKey)
	if !publicKey.Verify(msg, (*libkb.NaclSignature)(&ret.Sig)) {
		t.Error(libkb.VerificationError{})
	}

	// This should log out tc1:
	if err := NewMetaContextForTest(tc1).LogoutAndDeprovisionIfRevoked(); err != nil {
		t.Fatal(err)
	}

	AssertLoggedOut(tc1)

	// And now this should fail.
	ret, err = SignED25519(context.TODO(), tc1.G, f, keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err == nil {
		t.Fatal("nil error signing after LogoutAndDeprovisionIfRevoked")
	}
	if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Errorf("error type: %T, expected libkb.LoginRequiredError", err)
	}
}

// Check that if not on a revoked device that LogoutAndDeprovisionIfRevoked doesn't do anything.
func TestLogoutAndDeprovisionIfRevokedNoop(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "rev")

	AssertLoggedIn(tc)

	if err := NewMetaContextForTest(tc).LogoutAndDeprovisionIfRevoked(); err != nil {
		t.Fatal(err)
	}

	AssertLoggedIn(tc)

	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}

	msg := []byte("test message")
	ret, err := SignED25519(context.TODO(), tc.G, f, keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}
	publicKey := libkb.NaclSigningKeyPublic(ret.PublicKey)
	if !publicKey.Verify(msg, (*libkb.NaclSignature)(&ret.Sig)) {
		t.Error(libkb.VerificationError{})
	}
}

func revokeAnyPaperKey(tc libkb.TestContext, fu *FakeUser) *libkb.Device {
	t := tc.T
	t.Logf("revoke a paper key")
	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var revokeDevice *libkb.Device
	for _, device := range devices {
		if device.Type == libkb.DeviceTypePaper {
			revokeDevice = device
		}
	}
	require.NotNil(t, revokeDevice, "no paper key found to revoke")
	t.Logf("revoke %s", revokeDevice.ID)
	err := doRevokeDevice(tc, fu, revokeDevice.ID, false, false)
	require.NoError(t, err)
	return revokeDevice
}

func TestRevokeLastDevice(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "rev")

	assertNumDevicesAndKeys(tc, u, 1, 2)

	devices, _ := getActiveDevicesAndKeys(tc, u)
	thisDevice := devices[0]

	// Revoking the current device should fail.
	err := doRevokeDevice(tc, u, thisDevice.ID, false, false)
	if err == nil {
		t.Fatal("Expected revoking the current device to fail.")
	}

	assertNumDevicesAndKeys(tc, u, 1, 2)

	// Since this is the last device, it should fail with `force` too:
	err = doRevokeDevice(tc, u, thisDevice.ID, true, false)
	if err == nil {
		t.Fatal("Expected revoking the current last device to fail.")
	}

	assertNumDevicesAndKeys(tc, u, 1, 2)

	// With `force` and `forceLast`, the revoke should succeed
	err = doRevokeDevice(tc, u, thisDevice.ID, true, true)
	if err != nil {
		t.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, u, 0, 0)
}

func TestRevokeLastDevicePGP(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	u1 := createFakeUserWithPGPOnly(t, tc)
	assertNumDevicesAndKeys(tc, u1, 0, 1)
	Logout(tc)
	tc.Cleanup()

	tc = SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	testUserHasDeviceKey(tc)
	hasZeroPaperDev(tc, u1)
	if err := AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}

	devices, _ := getActiveDevicesAndKeys(tc, u1)
	thisDevice := devices[0]

	// Revoking the current device should fail.
	err := doRevokeDevice(tc, u1, thisDevice.ID, false, false)
	if err == nil {
		t.Fatal("Expected revoking the current device to fail.")
	}
	if _, ok := err.(libkb.RevokeLastDevicePGPError); !ok {
		t.Fatalf("expected libkb.RevokeLastDevicePGPError, got %T", err)
	}

	assertNumDevicesAndKeys(tc, u1, 1, 3)

	// Since this is the last device, it should fail with `force` too:
	err = doRevokeDevice(tc, u1, thisDevice.ID, true, false)
	if err == nil {
		t.Fatal("Expected revoking the current last device to fail.")
	}
	if _, ok := err.(libkb.RevokeLastDevicePGPError); !ok {
		t.Fatalf("expected libkb.RevokeLastDevicePGPError, got %T", err)
	}

	assertNumDevicesAndKeys(tc, u1, 1, 3)

	// With `force` and `forceLast`, the revoke should also fail because of pgp key
	err = doRevokeDevice(tc, u1, thisDevice.ID, true, true)
	if err == nil {
		t.Fatal("Expected revoking current last device with forceLast to fail")
	}
	if _, ok := err.(libkb.RevokeLastDevicePGPError); !ok {
		t.Fatalf("expected libkb.RevokeLastDevicePGPError, got %T", err)
	}

	assertNumDevicesAndKeys(tc, u1, 1, 3)
}
