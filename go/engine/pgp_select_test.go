package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
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
	s := NewSignupEngine(&arg, tc.G)
	testui := &gpgtestui{}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    testui,
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	if err := RunEngine(s, ctx); err != nil {
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

	fp := fmt.Sprintf("%s", publicKeys[0].GetFingerprint())
	garg := GPGImportKeyArg{
		Query:      fp,
		AllowMulti: true,
		SkipImport: false,
		OnlyImport: false,
	}
	gpg := NewGPGImportKeyEngine(&garg, tc.G)
	err = RunEngine(gpg, ctx)

	// The GPGImportKeyEngine converts a multi select on the same key into
	// an update, so our test checks that the update code ran, by counting
	// on the test version of the update key prompt.
	if testui.keyChosenCount != 1 {
		tc.T.Fatal("Selected the same key twice and no update happened")
	}

	return
}
