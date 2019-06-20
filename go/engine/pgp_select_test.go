// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io/ioutil"
	"path"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestSelectEngine(t *testing.T) {
	tc := SetupEngineTest(t, "select")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(t, "se")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipGPG = false
	s := NewSignupEngine(tc.G, &arg)
	testui := &gpgtestui{}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    testui,
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, s); err != nil {
		t.Fatal(err)
	}

	fuUser, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	if err != nil {
		tc.T.Fatal(err)
	}

	publicKeys := fuUser.GetActivePGPKeys(false)
	if len(publicKeys) != 1 {
		tc.T.Fatal("There should be one generated PGP key")
	}

	key := publicKeys[0]
	fp := fmt.Sprintf("%s", key.GetFingerprint())
	garg := GPGImportKeyArg{
		Query:      fp,
		AllowMulti: true,
		SkipImport: false,
		OnlyImport: false,
	}
	gpg := NewGPGImportKeyEngine(tc.G, &garg)
	err = RunEngine2(m, gpg)
	require.NoError(t, err)

	// The GPGImportKeyEngine converts a multi select on the same key into
	// an update, so our test checks that the update code ran, by counting
	// on the test version of the update key prompt.
	if testui.keyChosenCount != 1 {
		tc.T.Fatal("Selected the same key twice and no update happened")
	}
	if len(gpg.duplicatedFingerprints) != 1 {
		tc.T.Fatal("Server didn't return an error while updating")
	}
	if !key.GetFingerprint().Eq(gpg.duplicatedFingerprints[0]) {
		tc.T.Fatal("Our fingerprint ID wasn't returned as up to date")
	}
}

func TestPGPSelectThenPushSecret(t *testing.T) {
	tc := SetupEngineTest(t, "select")
	defer tc.Cleanup()

	user := CreateAndSignupFakeUser(tc, "selc")
	secUI := &libkb.TestSecretUI{Passphrase: user.Passphrase}

	err := tc.GenerateGPGKeyring(user.Email)
	require.NoError(t, err)

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secUI,
		GPGUI:    &gpgtestui{},
	}
	mctx := tc.MetaContext().WithUIs(uis)

	// PGP Select the key, without importing to local keyring.
	garg := GPGImportKeyArg{
		HasProvisionedDevice: true,
		AllowMulti:           false,
		SkipImport:           true,
		OnlyImport:           false,
	}
	gpgEng := NewGPGImportKeyEngine(tc.G, &garg)
	err = RunEngine2(mctx, gpgEng)
	require.NoError(t, err)

	kid := gpgEng.last.GetKID()

	// Secret key should not be available on the server.
	ss, err := mctx.ActiveDevice().SyncSecretsForce(mctx)
	require.NoError(t, err)
	_, ok := ss.FindPrivateKey(kid.String())
	require.False(t, ok)

	// Import secret key afterwards with pushing to the server.
	keyBytes, err := ioutil.ReadFile(path.Join(tc.Tp.GPGHome, "secring.gpg"))
	require.NoError(t, err)
	pgpEng, err := NewPGPKeyImportEngineFromBytes(tc.G, keyBytes, true /* pushSecret*/)
	require.NoError(t, err)
	mctx = tc.MetaContext().WithUIs(uis)
	err = RunEngine2(mctx, pgpEng)
	require.NoError(t, err)

	// Secret key should *be* available on the server (pushSecret=true in GPG
	// import engine above).
	ss, err = mctx.ActiveDevice().SyncSecretsForce(mctx)
	require.NoError(t, err)
	privKey, ok := ss.FindPrivateKey(kid.String())
	require.True(t, ok)
	require.NotEmpty(t, privKey.Bundle)
}
