// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func createFakeUserWithNoKeys(tc libkb.TestContext) (username, passphrase string) {
	username, email := fakeUser(tc.T, "login")
	passphrase = fakePassphrase(tc.T)

	s := NewSignupEngine(nil, tc.G)

	f := func(a libkb.LoginContext) error {
		// going to just run the join step of signup engine
		if err := s.genPassphraseStream(a, passphrase); err != nil {
			return err
		}

		if err := s.join(a, username, email, libkb.TestInvitationCode, true); err != nil {
			return err
		}

		return nil
	}
	if err := s.G().LoginState().ExternalFunc(f, "createFakeUserWithNoKeys"); err != nil {
		tc.T.Fatal(err)
	}

	return username, passphrase
}

// createFakeUserWithPGPOnly creates a new fake/testing user, who signed
// up on the Web site, and used the Web site to generate his/her key.  They
// used triplesec-encryption and synced their key to the keybase servers.
func createFakeUserWithPGPOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, "login")

	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(nil, tc.G)

	f := func(a libkb.LoginContext) error {
		if err := s.genPassphraseStream(a, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			return err
		}

		return s.fakeLKS()
	}
	if err := s.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPOnly"); err != nil {
		tc.T.Fatal(err)
	}

	// Generate a new test PGP key for the user, and specify the PushSecret
	// flag so that their triplesec'ed key is pushed to the server.
	gen := libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}
	gen.AddDefaultUID()
	peng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Gen:        &gen,
		PushSecret: true,
		Lks:        s.lks,
		NoSave:     true,
	})

	if err := RunEngine(peng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	var err error
	fu.User, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}

	return fu
}

// private gpg key not pushed to server
func createFakeUserWithPGPPubOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}

	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil, tc.G)
	ctx := &Context{
		GPGUI:    &gpgPubOnlyTestUI{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	f := func(a libkb.LoginContext) error {
		if err := s.genPassphraseStream(a, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			return err
		}

		if err := s.fakeLKS(); err != nil {
			return err
		}

		if err := s.addGPG(a, ctx, false); err != nil {
			return err
		}
		return nil
	}
	if err := s.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPPubOnly"); err != nil {
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

	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil, tc.G)
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	f := func(a libkb.LoginContext) error {
		if err := s.genPassphraseStream(a, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			t.Fatal(err)
		}

		fu.User = s.GetMe()

		// fake the lks:
		if err := s.fakeLKS(); err != nil {
			return err
		}

		if err := s.addGPG(a, ctx, false); err != nil {
			return err
		}

		// hack the gpg ui to select a different key:
		ctx.GPGUI = &gpgtestui{index: 1}
		if err := s.addGPG(a, ctx, true); err != nil {
			return err
		}

		return nil
	}

	if err := s.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPPubMult"); err != nil {
		t.Fatal(err)
	}
	// now it should have two pgp keys...

	return fu
}

// multiple pgp keys, but only the one with fu.Email associated w/
// keybase account
func createFakeUserWithPGPMultSubset(t *testing.T, tc libkb.TestContext, alternateEmail string) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email, alternateEmail); err != nil {
		t.Fatal(err)
	}

	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil, tc.G)
	ctx := &Context{
		GPGUI:    newGPGSelectEmailUI(fu.Email),
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	f := func(a libkb.LoginContext) error {
		if err := s.genPassphraseStream(a, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			t.Fatal(err)
		}

		fu.User = s.GetMe()

		// fake the lks:
		if err := s.fakeLKS(); err != nil {
			return err
		}

		// this will add the GPG key for fu.Email to their account
		if err := s.addGPG(a, ctx, false); err != nil {
			return err
		}

		return nil
	}

	if err := s.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPMultSubset"); err != nil {
		t.Fatal(err)
	}
	// now it should have two pgp keys...

	return fu
}

func createFakeUserWithPGPSibkey(tc libkb.TestContext) *FakeUser {
	fu := CreateAndSignupFakeUser(tc, "pgp")

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

func createFakeUserWithPGPSibkeyPaper(tc libkb.TestContext) *FakeUser {
	fu := CreateAndSignupFakeUserPaper(tc, "pgp")

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

func createFakeUserWithPGPSibkeyPushed(tc libkb.TestContext) *FakeUser {
	fu := CreateAndSignupFakeUser(tc, "pgp")

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		PushSecret: true,
		NoSave:     true,
		Ctx:        tc.G,
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

func createFakeUserWithPGPSibkeyPushedPaper(tc libkb.TestContext) *FakeUser {
	fu := CreateAndSignupFakeUserPaper(tc, "pgp")

	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		PushSecret: true,
		NoSave:     true,
		Ctx:        tc.G,
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

// fakeLKS is used to create a lks that has the server half when
// creating a fake user that doesn't have a device.
func (s *SignupEngine) fakeLKS() error {
	s.lks = libkb.NewLKSec(s.ppStream, s.uid, s.G())
	return s.lks.GenerateServerHalf()
}
