package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestRevokeSig(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	// The PGP key is the 5th signature in the user's chain.
	u := createFakeUserWithPGPSibkey(tc)
	assertNumDevicesAndKeys(t, u, 2, 5)

	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}

	// Add another PGP key, so that we have a couple to revoke. That means that
	// signatures #5 and #6 are the ones that delegate our PGP keys.
	const FirstPGPSigSeqno = 5
	const SecondPGPSigSeqno = 6

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		AllowMulti: true,
	}
	arg.Gen.MakeAllIds()
	pgpEngine := NewPGPKeyImportEngine(arg)
	err := RunEngine(pgpEngine, ctx)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(t, u, 2, 6)

	// First test that a bad sig id fails the revoke.
	revokeEngine := NewRevokeSigsEngine([]keybase1.SigID{"9999"}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err == nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(t, u, 2, 6) // no change

	// Check it with real sig id
	realUser, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	if err != nil {
		t.Fatal(err)
	}
	sigID := realUser.GetSigIDFromSeqno(FirstPGPSigSeqno)
	revokeEngine = NewRevokeSigsEngine([]keybase1.SigID{sigID}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err != nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(t, u, 2, 5) // The first PGP key is gone.

	// Revoking the same key again should fail.
	revokeEngine = NewRevokeSigsEngine([]keybase1.SigID{sigID}, tc.G)
	err = RunEngine(revokeEngine, ctx)
	if err == nil {
		t.Fatal(err)
	}
	assertNumDevicesAndKeys(t, u, 2, 5) // no change
}
