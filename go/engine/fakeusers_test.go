package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func createFakeUserWithNoKeys(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(nil)

	// going to just run the join step of signup engine
	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
}

func createFakeUserWithDetKey(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(nil)

	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	// generate the detkey only, using SelfProof
	arg := &DetKeyArgs{
		Me:        s.me,
		Tsp:       s.tspkey,
		SelfProof: true,
	}
	eng := NewDetKeyEngine(arg)
	ctx := &Context{LogUI: G.UI.GetLogUI()}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
}

// createFakeUserWithPGPOnly creates a new fake/testing user, who signed
// up on the Web site, and used the Web site to generate his/her key.  They
// used triplesec-encryption and synced their key to the keybase servers.
func createFakeUserWithPGPOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(nil)

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	s.fakeLKS()

	// Generate a new test PGP key for the user, and specify the PushSecret
	// flag so that their triplesec'ed key is pushed to the server.
	gen := libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}
	gen.AddDefaultUid()
	peng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Gen:        &gen,
		PushSecret: true,
		Lks:        s.lks,
		NoSave:     true,
	})

	fu.User = s.GetMe()

	if err := RunEngine(peng, ctx); err != nil {
		t.Fatal(err)
	}

	return fu
}

// private key not pushed to server
func createFakeUserWithPGPPubOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil)
	ctx := &Context{
		GPGUI:    &gpgPubOnlyTestUI{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	s.fakeLKS()

	if err := s.addGPG(ctx, false); err != nil {
		t.Fatal(err)
	}

	return fu
}

// multiple pgp keys
func createFakeUserWithPGPMult(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email, "xxx@xxx.com"); err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil)
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	fu.User = s.GetMe()

	// fake the lks:
	s.fakeLKS()

	if err := s.addGPG(ctx, false); err != nil {
		t.Fatal(err)
	}

	// hack the gpg ui to select a different key:
	ctx.GPGUI = &gpgtestui{index: 1}
	if err := s.addGPG(ctx, true); err != nil {
		t.Fatal(err)
	}

	// now it should have two pgp keys...

	return fu
}

func createFakeUserWithPGPSibkey(t *testing.T) *FakeUser {
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
	return fu
}

// fakeLKS is used to create a lks that has the server half when
// creating a fake user that doesn't have a device.
func (s *SignupEngine) fakeLKS() {
	s.lks = libkb.NewLKSec(s.tspkey.LksClientHalf(), s.G())
	s.lks.GenerateServerHalf()
}
