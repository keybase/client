// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestScanKeys(t *testing.T) {
	tc := SetupEngineTest(t, "ScanKeys")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")
	m := NewMetaContextForTest(tc).WithSecretUI(fu.NewSecretUI())

	sk, err := NewScanKeys(m)
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 0 {
		t.Errorf("scankey count: %d, expected 0", sk.Count())
	}
}

// TestScanKeysSync checks a user with a synced PGP key
func TestScanKeysSync(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()

	// First setup a user with a synced PGP private key
	fu := createFakeUserWithPGPOnly(t, tc)
	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: fu.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    fu.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}

	// Now provision a full device.
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewLogin(tc.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	err := RunEngine2(m, eng)
	require.NoError(t, err, "provisioning worked")

	// Now scankeys should work without any additional secrets.
	m = m.WithUIs(libkb.UIs{})
	sk, err := NewScanKeys(m)
	require.NoError(t, err, "scanning keys worked")

	if sk.Count() != 1 {
		t.Errorf("scankey count: %d, expected 1", sk.Count())
	}
}
