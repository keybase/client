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

	u1 := createFakeUserWithPGPPubOnly(t, tc)
	Logout(tc)

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "pgpprov")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// now safe to cleanup first home
	tc.Cleanup()

	// run PGPProvision on new device
	ctx := &Context{
		LoginUI:  &libkb.TestLoginUI{Username: u1.Username},
		SecretUI: u1.NewSecretUI(),
	}
	eng := NewPGPProvision(tc2.G, u1.Username, "new device", "xxx")
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	/*
		ctx := &Context{
			ProvisionUI: newTestProvisionUIGPGImport(),
			LogUI:       tc2.G.UI.GetLogUI(),
			SecretUI:    u1.NewSecretUI(),
			LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
			GPGUI:       &gpgtestui{},
		}
		eng := NewLogin(tc2.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}
	*/

	testUserHasDeviceKey(tc2)

	// highly possible they didn't have a paper key, so make sure they have one now:
	hasOnePaperDev(tc2, u1)

	if err := AssertProvisioned(tc2); err != nil {
		t.Fatal(err)
	}

	// since they imported their pgp key, they should be able to pgp sign something:
	if err := signString(tc2, "sign me", u1.NewSecretUI()); err != nil {
		t.Error("pgp sign failed after gpg provision w/ import")
		t.Fatal(err)
	}
}
