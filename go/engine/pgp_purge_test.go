// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Test the export of the keys.
func TestPGPPurgeLksec(t *testing.T) {
	tc := SetupEngineTest(t, "purge")
	defer tc.Cleanup()

	createFakeUserWithPGPSibkey(tc)

	idUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{
		SecretUI:   &libkb.TestSecretUI{}, // empty on purpose...shouldn't be necessary
		SaltpackUI: &fakeSaltpackUI{},
		IdentifyUI: idUI,
	}
	eng := NewPGPPurge(tc.G, keybase1.PGPPurgeArg{})
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if len(eng.KeyFiles()) != 1 {
		t.Fatalf("number of exported key files: %d, expected 1", len(eng.KeyFiles()))
	}
}

// Test the removal of the keys.
func TestPGPPurgeRemove(t *testing.T) {
	tc := SetupEngineTest(t, "purge")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)

	idUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{
		SecretUI:   &libkb.TestSecretUI{}, // empty on purpose...shouldn't be necessary
		SaltpackUI: &fakeSaltpackUI{},
		IdentifyUI: idUI,
	}
	eng := NewPGPPurge(tc.G, keybase1.PGPPurgeArg{DoPurge: true})
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if len(eng.KeyFiles()) != 1 {
		t.Fatalf("number of exported key files: %d, expected 1", len(eng.KeyFiles()))
	}

	kr := libkb.NewSKBKeyringFile(tc.G, libkb.NewNormalizedUsername(u.Username))
	if err := kr.LoadAndIndex(); err != nil {
		t.Fatal(err)
	}
	if kr.HasPGPKeys() {
		t.Fatal("after purge, keyring has pgp keys")
	}

	// redo, should purge 0 files

	eng = NewPGPPurge(tc.G, keybase1.PGPPurgeArg{DoPurge: true})
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if len(eng.KeyFiles()) != 0 {
		t.Fatalf("number of exported key files: %d, expected 0", len(eng.KeyFiles()))
	}

}

// Create a user with a synced PGP key.  PGPPurge shouldn't touch it.
func TestPGPPurgeSync(t *testing.T) {
	tc := SetupEngineTest(t, "purge")
	u1 := createFakeUserWithPGPOnly(t, tc)
	Logout(tc)
	tc.Cleanup()

	tc = SetupEngineTest(t, "purge")
	defer tc.Cleanup()

	lctx := &Context{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	leng := NewLogin(tc.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	if err := RunEngine(leng, lctx); err != nil {
		t.Fatal(err)
	}

	// user has device keys + synced 3sec pgp key

	idUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{
		SecretUI:   &libkb.TestSecretUI{}, // empty on purpose...shouldn't be necessary
		SaltpackUI: &fakeSaltpackUI{},
		IdentifyUI: idUI,
	}
	eng := NewPGPPurge(tc.G, keybase1.PGPPurgeArg{})
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if len(eng.KeyFiles()) != 0 {
		t.Fatalf("number of exported key files: %d, expected 0", len(eng.KeyFiles()))
	}
}
