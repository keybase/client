package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestGenerateNewPGPKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgp")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "pgp")
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}
}
