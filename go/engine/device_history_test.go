// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDeviceHistoryBasic(t *testing.T) {
	tc := SetupEngineTest(t, "devhist")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "dhst")

	eng := NewDeviceHistorySelf(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}
	devs := eng.Devices()
	require.Equal(t, 2, len(devs), "num devices: %d, expected 2", len(devs))

	var desktop keybase1.DeviceDetail
	var paper keybase1.DeviceDetail

	for _, d := range devs {
		switch d.Device.Type {
		case keybase1.DeviceTypeV2_PAPER:
			paper = d
		case keybase1.DeviceTypeV2_DESKTOP:
			desktop = d
		default:
			require.FailNow(t, fmt.Sprintf("unexpected device type %s", d.Device.Type))
		}
	}

	// paper's provisioner should be desktop
	require.NotNil(t, paper.Provisioner,
		"paper device has no provisioner")
	require.Equal(t, desktop.Device.DeviceID, paper.Provisioner.DeviceID, "paper provisioned id: %s, expected %s", paper.Provisioner.DeviceID, desktop.Device.DeviceID)
	t.Logf("desktop: %+v", desktop)
	t.Logf("paper:   %+v", paper)

	// Check that LastUsedTime is set (since we're fetching our own device history)
	for _, d := range devs {
		require.NotZero(t, d.Device.LastUsedTime, "last used time not set")
	}
}

func TestDeviceHistoryRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "devhist")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUserPaper(tc, "dhst")

	eng := NewDeviceHistorySelf(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	var desktop keybase1.DeviceDetail
	var paper keybase1.DeviceDetail

	for _, d := range eng.Devices() {
		switch d.Device.Type {
		case keybase1.DeviceTypeV2_PAPER:
			paper = d
		case keybase1.DeviceTypeV2_DESKTOP:
			desktop = d
		default:
			require.FailNow(t, fmt.Sprintf("unexpected device type %s", d.Device.Type))
		}
	}

	// paper's provisioner should be desktop
	require.NotNil(t, paper.Provisioner,
		"paper device has no provisioner")
	require.Equal(t, desktop.Device.DeviceID, paper.Provisioner.DeviceID, "paper provisioned id: %s, expected %s", paper.Provisioner.DeviceID, desktop.Device.DeviceID)
	t.Logf("desktop: %+v", desktop)
	t.Logf("paper:   %+v", paper)

	// revoke the paper device
	uis := libkb.UIs{
		SecretUI: u.NewSecretUI(),
		LogUI:    tc.G.UI.GetLogUI(),
	}
	m = NewMetaContextForTest(tc).WithUIs(uis)
	reng := NewRevokeDeviceEngine(tc.G, RevokeDeviceEngineArgs{ID: paper.Device.DeviceID})
	if err := RunEngine2(m, reng); err != nil {
		require.NoError(t, err)
	}

	// get history after revoke
	eng = NewDeviceHistorySelf(tc.G)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	var desktop2 keybase1.DeviceDetail
	var paper2 keybase1.DeviceDetail

	for _, d := range eng.Devices() {
		switch d.Device.Type {
		case keybase1.DeviceTypeV2_PAPER:
			paper2 = d
		case keybase1.DeviceTypeV2_DESKTOP:
			desktop2 = d
		default:
			require.FailNow(t, fmt.Sprintf("unexpected device type %s", d.Device.Type))
		}
	}

	// paper's provisioner should (still) be desktop
	require.NotNil(t, paper2.Provisioner,
		"paper device has no provisioner")
	require.Equal(t, desktop2.Device.DeviceID, paper2.Provisioner.DeviceID, "paper provisioned id: %s, expected %s", paper2.Provisioner.DeviceID, desktop2.Device.DeviceID)
	t.Logf("desktop: %+v", desktop2)
	t.Logf("paper:   %+v", paper2)

	require.NotNil(t, paper2.RevokedAt,
		"paper device RevokedAt is nil")
	require.False(t, paper2.RevokedBy.IsNil(),
		"paper device RevokedBy is nil")
	require.NotNil(t, paper2.RevokedByDevice,
		"paper device RevokedByDevice is nil")
	require.Equal(t, desktop.Device.DeviceID, paper2.RevokedByDevice.DeviceID, "paper revoked by wrong device, %s != %s", paper2.RevokedByDevice.DeviceID,
		desktop.Device.DeviceID)
	require.Equal(t, desktop.Device.Name, paper2.RevokedByDevice.Name, "paper revoked by wrong device, %s != %s", paper2.RevokedByDevice.Name,
		desktop.Device.Name)
}

func TestDeviceHistoryPGP(t *testing.T) {
	tc := SetupEngineTest(t, "devhist")
	u1 := createFakeUserWithPGPOnly(t, tc)
	t.Log("Created fake synced pgp user")
	Logout(tc)
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc = SetupEngineTest(t, "devhist")
	defer tc.Cleanup()

	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc.G, keybase1.DeviceTypeV2_DESKTOP, "", keybase1.ClientType_CLI)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	heng := NewDeviceHistorySelf(tc.G)
	if err := RunEngine2(m, heng); err != nil {
		require.NoError(t, err)
	}
	devs := heng.Devices()
	require.Equal(t, 1, len(devs), "num devices: %d, expected 1", len(devs))
}
