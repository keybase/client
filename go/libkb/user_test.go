// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestExportUser(t *testing.T) {
	tc := SetupTest(t, "export_user", 1)
	defer tc.Cleanup()
	alice, err := LoadUser(NewLoadUserByNameArg(tc.G, "t_alice"))
	if err != nil {
		t.Fatal(err)
	}

	exportedAlice := alice.Export()

	if exportedAlice.Uid.String() != "295a7eea607af32040647123732bc819" {
		t.Fatal("wrong UID", exportedAlice.Uid)
	}

	if exportedAlice.Username != "t_alice" {
		t.Fatal("wrong username", exportedAlice.Username)
	}

	var publicKeys []keybase1.PublicKey
	if alice.GetComputedKeyFamily() != nil {
		publicKeys = alice.GetComputedKeyFamily().Export()
	}

	if len(publicKeys) != 1 {
		t.Fatal("expected 1 public key", publicKeys)
	}

	if publicKeys[0].PGPFingerprint != "2373fd089f28f328916b88f99c7927c0bdfdadf9" {
		t.Fatal("wrong fingerprint", publicKeys[0].PGPFingerprint)
	}
}
