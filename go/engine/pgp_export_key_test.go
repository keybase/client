// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestPGPExportOptions(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	fp, kid, key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), true, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	table := []exportTest{
		{true, fp.String(), false, 1, 1, 0},
		{true, fp.String(), true, 1, 1, 0},
		{false, fp.String(), false, 1, 1, 0},
		{false, fp.String(), true, 1, 1, 0},

		// fingerprint substring must be suffix:
		{true, fp.String()[len(fp.String())-5:], false, 1, 1, 0},
		{true, fp.String()[len(fp.String())-5:], true, 0, 0, 0},
		{false, fp.String()[len(fp.String())-5:], false, 1, 1, 0},
		{false, fp.String()[len(fp.String())-5:], true, 0, 0, 0},
		{true, fp.String()[0:5], false, 0, 0, 0},
		{true, fp.String()[0:5], true, 0, 0, 0},
		{false, fp.String()[0:5], false, 0, 0, 0},
		{false, fp.String()[0:5], true, 0, 0, 0},

		{true, kid.String(), false, 1, 0, 1},
		{true, kid.String(), true, 1, 0, 1},
		{false, kid.String(), false, 1, 0, 1},
		{false, kid.String(), true, 1, 0, 1},

		// kid substring must be prefix:
		{true, kid.String()[len(fp.String())-5:], false, 0, 0, 0},
		{true, kid.String()[len(fp.String())-5:], true, 0, 0, 0},
		{false, kid.String()[len(fp.String())-5:], false, 0, 0, 0},
		{false, kid.String()[len(fp.String())-5:], true, 0, 0, 0},
		{true, kid.String()[0:5], false, 1, 0, 1},
		{true, kid.String()[0:5], true, 0, 0, 0},
		{false, kid.String()[0:5], false, 1, 0, 1},
		{false, kid.String()[0:5], true, 0, 0, 0},
	}

	for i, test := range table {
		ec, err := pgpExport(ctx, tc.G, test.secret, test.query, test.exact)
		if err != nil {
			t.Errorf("test %d error: %s", i, err)
		}
		if ec.either != test.either {
			t.Errorf("test %d: (either) num keys exported: %d, expected %d", i, ec.either, test.either)
		}
		if ec.fingerprint != test.fingerprint {
			t.Errorf("test %d: (fp) num keys exported: %d, expected %d", i, ec.fingerprint, test.fingerprint)
		}
		if ec.kid != test.kid {
			t.Errorf("test %d: (kid) num keys exported: %d, expected %d", i, ec.kid, test.kid)
		}
	}
}

type exportTest struct {
	secret      bool
	query       string
	exact       bool
	either      int
	fingerprint int
	kid         int
}

type exportCounts struct {
	either      int
	fingerprint int
	kid         int
}

func pgpExport(ctx *Context, g *libkb.GlobalContext, secret bool, query string, exact bool) (exportCounts, error) {
	opts := keybase1.PGPQuery{
		Secret:     secret,
		Query:      query,
		ExactMatch: exact,
	}

	var xcount exportCounts

	arg := keybase1.PGPExportArg{
		Options: opts,
	}
	xe := NewPGPKeyExportEngine(arg, g)
	if err := RunEngine(xe, ctx); err != nil {
		return xcount, err
	}

	xcount.either = len(xe.Results())

	farg := keybase1.PGPExportByFingerprintArg{
		Options: opts,
	}
	xf := NewPGPKeyExportByFingerprintEngine(farg, g)
	if err := RunEngine(xf, ctx); err != nil {
		return xcount, err
	}

	xcount.fingerprint = len(xf.Results())

	karg := keybase1.PGPExportByKIDArg{
		Options: opts,
	}
	xk := NewPGPKeyExportByKIDEngine(karg, g)
	if err := RunEngine(xk, ctx); err != nil {
		return xcount, err
	}

	xcount.kid = len(xk.Results())

	return xcount, nil
}
