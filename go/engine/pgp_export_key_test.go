// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestPGPExportOptions(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}
	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	fp, kid, key := genPGPKeyAndArmor(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes(tc.G, []byte(key), true)
	if err != nil {
		t.Fatal(err)
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err = RunEngine2(m, eng); err != nil {
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
		ec, err := pgpExport(m, test.secret, test.query, test.exact)
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

func pgpExport(m libkb.MetaContext, secret bool, query string, exact bool) (exportCounts, error) {
	opts := keybase1.PGPQuery{
		Secret:     secret,
		Query:      query,
		ExactMatch: exact,
	}

	var xcount exportCounts

	arg := keybase1.PGPExportArg{
		Options: opts,
	}
	g := m.G()
	xe := NewPGPKeyExportEngine(g, arg)
	if err := RunEngine2(m, xe); err != nil {
		return xcount, err
	}

	xcount.either = len(xe.Results())

	farg := keybase1.PGPExportByFingerprintArg{
		Options: opts,
	}
	xf := NewPGPKeyExportByFingerprintEngine(g, farg)
	if err := RunEngine2(m, xf); err != nil {
		return xcount, err
	}

	xcount.fingerprint = len(xf.Results())

	karg := keybase1.PGPExportByKIDArg{
		Options: opts,
	}
	xk := NewPGPKeyExportByKIDEngine(g, karg)
	if err := RunEngine2(m, xk); err != nil {
		return xcount, err
	}

	xcount.kid = len(xk.Results())

	return xcount, nil
}

type PGPTestSecretUI struct {
	libkb.TestSecretUI
	Prompts []string
}

func (t *PGPTestSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	t.CalledGetPassphrase = true
	t.Prompts = append(t.Prompts, p.Prompt)
	return keybase1.GetPassphraseRes{
		Passphrase:  t.Passphrase,
		StoreSecret: t.StoreSecret,
	}, nil
}

func TestPGPExportEncryption(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	pgpPassphrase := "hello_pgp" + u.Passphrase
	secui := &PGPTestSecretUI{}
	secui.Passphrase = pgpPassphrase
	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	fp, _, key := genPGPKeyAndArmor(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes(tc.G, []byte(key), true)
	require.NoError(t, err)

	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	opts := keybase1.PGPQuery{
		Secret:     true,
		Query:      fp.String(),
		ExactMatch: true,
	}

	// Run export with Encrypted: true

	arg := keybase1.PGPExportArg{
		Options:   opts,
		Encrypted: true,
	}
	xe := NewPGPKeyExportEngine(tc.G, arg)
	if err := RunEngine2(m, xe); err != nil {
		t.Fatal(err)
	}

	require.Len(t, secui.Prompts, 2, "Expected two prompts in SecretUI (PGP passphrase and confirmation)")
	secui.Prompts = []string{}

	entity, _, err := libkb.ReadOneKeyFromString(xe.Results()[0].Key)
	require.NoError(t, err)

	require.NotNil(t, entity.PrivateKey, "Key isn't private key")
	require.True(t, entity.PrivateKey.Encrypted, "Key is not encrypted")

	for i, subkey := range entity.Subkeys {
		require.True(t, subkey.PrivateKey.Encrypted, "Subkey %d is not encrypted", i)
	}

	if err := entity.PrivateKey.Decrypt([]byte(pgpPassphrase)); err != nil {
		t.Fatal("Decryption with passphrase failed")
	}

	// Run export with Encrypted: false

	arg = keybase1.PGPExportArg{
		Options:   opts,
		Encrypted: false,
	}
	xe = NewPGPKeyExportEngine(tc.G, arg)
	err = RunEngine2(m, xe)
	require.NoError(t, err)

	require.Len(t, secui.Prompts, 0, "Expected no prompts in SecretUI")

	entity, _, err = libkb.ReadOneKeyFromString(xe.Results()[0].Key)
	require.NoError(t, err)

	require.NotNil(t, entity.PrivateKey, "Key isn't private key")
	require.False(t, entity.PrivateKey.Encrypted, "Key is encrypted")

	for i, subkey := range entity.Subkeys {
		require.False(t, subkey.PrivateKey.Encrypted, "Subkey %d is encrypted", i)
	}
}

func TestPGPExportMultipleSyncedKeys(t *testing.T) {
	tc := SetupEngineTest(t, "pgpexport")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "pgp")

	secui := &PGPTestSecretUI{}
	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	// Generate two keys and import with pushPrivate.
	fps := make([]libkb.PGPFingerprint, 2)
	for i := range fps {
		fp, _, key := genPGPKeyAndArmor(t, tc, u.Email)
		eng, err := NewPGPKeyImportEngineFromBytes(tc.G, []byte(key), true /* pushPrivate */)
		require.NoError(t, err)

		m := NewMetaContextForTest(tc).WithUIs(uis)
		err = RunEngine2(m, eng)
		require.NoError(t, err)

		fps[i] = fp
	}

	// Purge PGP keys from local keychain so we are forced to fetch server
	// synced keys.
	{
		eng := NewPGPPurge(tc.G, keybase1.PGPPurgeArg{
			DoPurge: true,
		})
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
	}

	t.Logf("Trying to export keys now")

	// Try to export each key.
	for _, fp := range fps {
		arg := keybase1.PGPExportArg{
			Options: keybase1.PGPQuery{
				Secret:     true,
				Query:      fp.String(),
				ExactMatch: true,
			},
			Encrypted: false,
		}
		eng := NewPGPKeyExportEngine(tc.G, arg)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)

		require.Len(t, eng.Results(), 1)

		entity, _, err := libkb.ReadOneKeyFromString(eng.Results()[0].Key)
		require.NoError(t, err)

		require.NotNil(t, entity.PrivateKey, "Key isn't private key")
		require.Equal(t, fp, entity.GetFingerprint())
	}
}
