// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestRevokeSig(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	// The PGP key is the 5th signature in the user's chain.
	u := createFakeUserWithPGPSibkeyPaper(tc)
	assertNumDevicesAndKeys(tc, u, 2, 5)

	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}

	// Add another PGP key, so that we have a couple to revoke. That means that
	// signatures #6 and #7 are the ones that delegate our PGP keys.
	const FirstPGPSigSeqno = 6
	const SecondPGPSigSeqno = 7

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		AllowMulti: true,
	}
	arg.Gen.MakeAllIds(tc.G)
	pgpEngine := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, pgpEngine)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 6)

	// First test that a bad sig id fails the revoke.
	revokeEngine := NewRevokeSigsEngine(tc.G, []string{"9999"})
	err = RunEngine2(m, revokeEngine)
	if err == nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 6) // no change

	// Check it with real sig id
	realUser, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	if err != nil {
		t.Fatal(err)
	}
	sigID := realUser.GetSigIDFromSeqno(FirstPGPSigSeqno)
	revokeEngine = NewRevokeSigsEngine(tc.G, []string{sigID.ToString(true)})
	err = RunEngine2(m, revokeEngine)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // The first PGP key is gone.

	// Revoking the same key again should fail.
	revokeEngine = NewRevokeSigsEngine(tc.G, []string{sigID.ToString(true)})
	err = RunEngine2(m, revokeEngine)
	if err == nil {
		t.Fatal("RevokeSigs should have failed, but it didn't")
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // no change

	// Revoke the second pgp key by prefix:
	nextID := realUser.GetSigIDFromSeqno(SecondPGPSigSeqno).ToString(true)

	// Short prefix should fail:
	revokeEngine = NewRevokeSigsEngine(tc.G, []string{nextID[0:4]})
	err = RunEngine2(m, revokeEngine)
	if err == nil {
		t.Fatal("revoke with 4 char prefix didn't return err")
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // no change

	// SigIDQueryMin-character prefix should work:
	revokeEngine = NewRevokeSigsEngine(tc.G, []string{nextID[0:keybase1.SigIDQueryMin]})
	err = RunEngine2(m, revokeEngine)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 4) // second pgp key gone
}
