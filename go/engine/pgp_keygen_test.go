// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestPGPKeyGenPush(t *testing.T) {
	tc := SetupEngineTest(t, "pgpkeygen")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "pgp")
	pgpUI := &TestPgpUI{ShouldPush: true}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
		PgpUI:    pgpUI,
	}
	arg := keybase1.PGPKeyGenDefaultArg{
		CreateUids: keybase1.PGPCreateUids{
			UseDefault: true,
			Ids: []keybase1.PGPIdentity{
				{Username: u.Username, Email: u.Email},
			},
		},
	}
	eng := NewPGPKeyGen(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	xarg := keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  pgpUI.Generated.Key.Fingerprint,
		},
	}
	xe := NewPGPKeyExportEngine(xarg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 1 {
		t.Errorf("result keys: %d, expected 1", len(xe.Results()))
	}
}

func TestPGPKeyGenNoPush(t *testing.T) {
	tc := SetupEngineTest(t, "pgpkeygen")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "pgp")
	pgpUI := &TestPgpUI{ShouldPush: false}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
		PgpUI:    pgpUI,
	}
	arg := keybase1.PGPKeyGenDefaultArg{
		CreateUids: keybase1.PGPCreateUids{
			UseDefault: true,
			Ids: []keybase1.PGPIdentity{
				{Username: u.Username, Email: u.Email},
			},
		},
	}
	eng := NewPGPKeyGen(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	xarg := keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  pgpUI.Generated.Key.Fingerprint,
		},
	}
	xe := NewPGPKeyExportEngine(xarg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 1 {
		t.Errorf("result keys: %d, expected 1", len(xe.Results()))
	}
}
