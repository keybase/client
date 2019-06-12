// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
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
