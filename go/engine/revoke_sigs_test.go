// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}

	// Add another PGP key, so that we have a couple to revoke. That means that
	// signatures #5 and #6 are the ones that delegate our PGP keys.
	const FirstPGPSigSeqno = 5
	const SecondPGPSigSeqno = 6

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		AllowMulti: true,
	}
	arg.Gen.MakeAllIds()
	pgpEngine := NewPGPKeyImportEngine(arg)
	err := RunEngine(pgpEngine, ctx)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 6)

	// First test that a bad sig id fails the revoke.
	revokeEngine := NewRevokeSigsEngine([]string{"9999"}, tc.G)
	err = RunEngine(revokeEngine, ctx)
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
	revokeEngine = NewRevokeSigsEngine([]string{sigID.ToString(true)}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // The first PGP key is gone.

	// Revoking the same key again should fail.
	revokeEngine = NewRevokeSigsEngine([]string{sigID.ToString(true)}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err == nil {
		t.Fatal("RevokeSigs should have failed, but it didn't")
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // no change

	// Revoke the second pgp key by prefix:
	nextID := realUser.GetSigIDFromSeqno(SecondPGPSigSeqno).ToString(true)

	// Short prefix should fail:
	revokeEngine = NewRevokeSigsEngine([]string{nextID[0:4]}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err == nil {
		t.Fatal("revoke with 4 char prefix didn't return err")
	}
	assertNumDevicesAndKeys(tc, u, 2, 5) // no change

	// SigIDQueryMin-character prefix should work:
	revokeEngine = NewRevokeSigsEngine([]string{nextID[0:keybase1.SigIDQueryMin]}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(tc, u, 2, 4) // second pgp key gone
}
