// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
)

func TestSecretKeys(t *testing.T) {
	tc := SetupEngineTest(t, "secretkeys")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "sk")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}

	// Get the secret keys.
	e := NewSecretKeysEngine(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, e)
	if err != nil {
		t.Fatal(err)
	}
	signing := e.Result().Signing

	// Now we want to check that the keys we got actually belong to the user.
	// Below we just do this check with the signing key, since it's easier to
	// derive the public key.

	// Build the signing keypair. To do this, we exploit the fact that a NaCl
	// public signing key is the last 32 bytes of the private signing key.
	var public kbcrypto.NaclSigningKeyPublic
	copy(public[:], signing[32:])
	pair := libkb.NaclSigningKeyPair{
		Public: public,
	}

	// Check the signing keypair's KID is in the user's KeyFamily.
	testUser, err := libkb.LoadUser(libkb.NewLoadUserArg(tc.G).WithName(u.Username))
	if err != nil {
		t.Fatal(err)
	}
	if found := testUser.GetKeyFamily().AllKIDs[pair.GetKID()]; !found {
		t.Fatalf("Failed to find %s in the user's key family.", pair.GetKID().String())
	}
}
