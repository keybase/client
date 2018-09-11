// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
)

func TestPGPKeyGenPush(t *testing.T) {
	tc := SetupEngineTest(t, "pgpkeygen")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "pgp")
	pgpUI := &TestPgpUI{ShouldPush: true}
	uis := libkb.UIs{
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
	eng.genArg = &libkb.PGPGenArg{
		PrimaryBits: 768,
		SubkeyBits:  768,
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	xarg := keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  pgpUI.Generated.Key.Fingerprint,
		},
	}
	xe := NewPGPKeyExportEngine(tc.G, xarg)
	if err := RunEngine2(m, xe); err != nil {
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
	uis := libkb.UIs{
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
	eng.genArg = &libkb.PGPGenArg{
		PrimaryBits: 768,
		SubkeyBits:  768,
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	xarg := keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  pgpUI.Generated.Key.Fingerprint,
		},
	}
	xe := NewPGPKeyExportEngine(tc.G, xarg)
	if err := RunEngine2(m, xe); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 1 {
		t.Errorf("result keys: %d, expected 1", len(xe.Results()))
	}
}
