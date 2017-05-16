// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestDeviceHistoryBasic(t *testing.T) {
	tc := SetupEngineTest(t, "devhist")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "dhst")

	ctx := &Context{}
	eng := NewDeviceHistorySelf(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	devs := eng.Devices()
	if len(devs) != 2 {
		t.Errorf("num devices: %d, expected 2", len(devs))
	}

	var desktop keybase1.DeviceDetail
	var paper keybase1.DeviceDetail

	for _, d := range devs {
		switch d.Device.Type {
		case libkb.DeviceTypePaper:
			paper = d
		case libkb.DeviceTypeDesktop:
			desktop = d
		default:
			t.Fatalf("unexpected device type %s", d.Device.Type)
		}
	}

	// paper's provisioner should be desktop
	if paper.Provisioner == nil {
		t.Fatal("paper device has no provisioner")
	}
	if paper.Provisioner.DeviceID != desktop.Device.DeviceID {
		t.Errorf("paper provisioned id: %s, expected %s", paper.Provisioner.DeviceID, desktop.Device.DeviceID)
		t.Logf("desktop: %+v", desktop)
		t.Logf("paper:   %+v", paper)
	}

	// Check that LastUsedTime is set (since we're fetching our own device history)
	for _, d := range devs {
		if d.Device.LastUsedTime == 0 {
			t.Fatal("last used time not set")
		}
	}
}

func TestDeviceHistoryRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "devhist")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUserPaper(tc, "dhst")

	ctx := &Context{}
	eng := NewDeviceHistorySelf(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	var desktop keybase1.DeviceDetail
	var paper keybase1.DeviceDetail

	for _, d := range eng.Devices() {
		switch d.Device.Type {
		case libkb.DeviceTypePaper:
			paper = d
		case libkb.DeviceTypeDesktop:
			desktop = d
		default:
			t.Fatalf("unexpected device type %s", d.Device.Type)
		}
	}

	// paper's provisioner should be desktop
	if paper.Provisioner == nil {
		t.Fatal("paper device has no provisioner")
	}
	if paper.Provisioner.DeviceID != desktop.Device.DeviceID {
		t.Errorf("paper provisioned id: %s, expected %s", paper.Provisioner.DeviceID, desktop.Device.DeviceID)
		t.Logf("desktop: %+v", desktop)
		t.Logf("paper:   %+v", paper)
	}

	// revoke the paper device
	ctx.SecretUI = u.NewSecretUI()
	ctx.LogUI = tc.G.UI.GetLogUI()
	reng := NewRevokeDeviceEngine(RevokeDeviceEngineArgs{ID: paper.Device.DeviceID}, tc.G)
	if err := RunEngine(reng, ctx); err != nil {
		t.Fatal(err)
	}

	// get history after revoke
	eng = NewDeviceHistorySelf(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	var desktop2 keybase1.DeviceDetail
	var paper2 keybase1.DeviceDetail

	for _, d := range eng.Devices() {
		switch d.Device.Type {
		case libkb.DeviceTypePaper:
			paper2 = d
		case libkb.DeviceTypeDesktop:
			desktop2 = d
		default:
			t.Fatalf("unexpected device type %s", d.Device.Type)
		}
	}

	// paper's provisioner should (still) be desktop
	if paper2.Provisioner == nil {
		t.Fatal("paper device has no provisioner")
	}
	if paper2.Provisioner.DeviceID != desktop2.Device.DeviceID {
		t.Errorf("paper provisioned id: %s, expected %s", paper2.Provisioner.DeviceID, desktop2.Device.DeviceID)
		t.Logf("desktop: %+v", desktop2)
		t.Logf("paper:   %+v", paper2)
	}

	if paper2.RevokedAt == nil {
		t.Fatal("paper device RevokedAt is nil")
	}
	if paper2.RevokedBy.IsNil() {
		t.Fatal("paper device RevokedBy is nil")
	}
	if paper2.RevokedByDevice == nil {
		t.Fatal("paper device RevokedByDevice is nil")
	}
	if paper2.RevokedByDevice.DeviceID != desktop.Device.DeviceID {
		t.Fatalf("paper revoked by wrong device, %s != %s", paper2.RevokedByDevice.DeviceID,
			desktop.Device.DeviceID)
	}
	if paper2.RevokedByDevice.Name != desktop.Device.Name {
		t.Fatalf("paper revoked by wrong device, %s != %s", paper2.RevokedByDevice.Name,
			desktop.Device.Name)
	}
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

	ctx := &Context{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	ctx = &Context{}
	heng := NewDeviceHistorySelf(tc.G)
	if err := RunEngine(heng, ctx); err != nil {
		t.Fatal(err)
	}
	devs := heng.Devices()
	if len(devs) != 1 {
		t.Errorf("num devices: %d, expected 1", len(devs))
	}
}
