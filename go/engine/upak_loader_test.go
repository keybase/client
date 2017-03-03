// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// There are two test files by this name. One in libkb, one in engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestLoadDeviceKeyNew(t *testing.T) {
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()
	t.Logf("create new user")
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	loginUI := &paperLoginUI{Username: fu.Username}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v", fu.Username)
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username)
	loadArg.PublicKeyOptional = true
	user, err := libkb.LoadUser(loadArg)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v uid: %+v", user.GetNormalizedName(), user.GetUID())

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var device1 *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper {
			device1 = device
		}
	}
	require.NotNil(t, device1, "device1 should be non-nil")
	t.Logf("using device1:%+v", device1.ID)

	t.Logf("load existing device key")
	upk, deviceKey, revoked, err := tc.G.GetUPAKLoader().LoadDeviceKey(nil, user.GetUID(), device1.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, device1.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *device1.Description, deviceKey.DeviceDescription, "device name must match")
	require.Nil(t, revoked, "device not revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(device1.ID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})

	Logout(tc)

	if len(loginUI.PaperPhrase) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	t.Logf("create new device")
	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	secUI := fu.NewSecretUI()
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: fu.Username}
	ctx = &Context{
		ProvisionUI: provUI,
		LogUI:       tc2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}

	eng := NewPaperProvisionEngine(tc2.G, fu.Username, "fakedevice", loginUI.PaperPhrase)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	t.Logf("d2 provisioned (1)")

	testUserHasDeviceKey(tc2)
	require.NoError(t, AssertProvisioned(tc2))
	t.Logf("d2 provisioned (2)")

	devices, _ = getActiveDevicesAndKeys(tc, fu)
	var device2 *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper && device.ID != device1.ID {
			device2 = device
		}
	}
	require.NotNil(t, device2, "device2 should be non-nil")
	t.Logf("using device2:%+v", device2.ID)

	t.Logf("load brand new device (while old is cached)")
	upk, deviceKey, revoked, err = tc.G.GetUPAKLoader().LoadDeviceKey(nil, user.GetUID(), device2.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, device2.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *device2.Description, deviceKey.DeviceDescription, "device name must match")
	require.Nil(t, revoked, "device not revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(deviceKey.DeviceID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})
}

func TestLoadDeviceKeyRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "rev")
	t.Logf("using username:%+v", fu.Username)
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username)
	loadArg.PublicKeyOptional = true
	user, err := libkb.LoadUser(loadArg)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v uid: %+v", user.GetNormalizedName(), user.GetUID())

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var thisDevice *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper {
			thisDevice = device
		}
	}

	// Revoke the current device with --force
	err = doRevokeDevice(tc, fu, thisDevice.ID, true)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, fu, 1, 2)

	t.Logf("load revoked device")
	upk, deviceKey, revoked, err := tc.G.GetUPAKLoader().LoadDeviceKey(nil, user.GetUID(), thisDevice.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, thisDevice.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *thisDevice.Description, deviceKey.DeviceDescription, "device name must match")
	require.NotNil(t, revoked, "device should be revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(deviceKey.DeviceID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		require.False(t, dev.IsActive())
		dev, err = u.GetDevice(thisDevice.ID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})
}

func TestFullSelfCacherFlush(t *testing.T) {
	tc := SetupEngineTest(t, "fsc")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "fsc")

	var scv libkb.Seqno
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		scv = u.GetSigChainLastKnownSeqno()
		return nil
	})
	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		require.True(t, u.GetSigChainLastKnownSeqno() > scv)
		return nil
	})
}
