// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// Provision device using PGPProvision engine.
func TestPGPProvision(t *testing.T) {
	tc := SetupEngineTest(t, "pgpprov")
	defer tc.Cleanup()

	// create a user w/ a synced pgp key
	u1 := createFakeUserWithPGPOnly(t, tc)
	t.Log("Created fake user")
	Logout(tc)

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "pgpprov")
	defer tc2.Cleanup()

	// run PGPProvision on new device
	uis := libkb.UIs{
		LoginUI:  &libkb.TestLoginUI{Username: u1.Username},
		SecretUI: &libkb.TestSecretUI{},
		LogUI:    tc2.G.UI.GetLogUI(),
	}
	eng := NewPGPProvision(tc2.G, u1.Username, "new device", u1.Passphrase)
	m := NewMetaContextForTest(tc2).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(tc2)

	if err := AssertProvisioned(tc2); err != nil {
		t.Fatal(err)
	}

	checkPerUserKeyCount(&tc, 1)
}
