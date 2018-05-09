// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func createFakeUserWithNoKeys(tc libkb.TestContext) (username, passphrase string) {
	username, email := fakeUser(tc.T, "login")
	passphrase = fakePassphrase(tc.T)
	m := NewMetaContextForTest(tc)
	s := NewSignupEngine(tc.G, nil)

	f := func(a libkb.LoginContext) error {
		m = m.WithLoginContext(a)
		// going to just run the join step of signup engine
		if err := s.genPassphraseStream(m, passphrase); err != nil {
			return err
		}

		return s.join(m, username, email, libkb.TestInvitationCode, true)
	}
	if err := m.G().LoginState().ExternalFunc(f, "createFakeUserWithNoKeys"); err != nil {
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
	uis := libkb.UIs{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, nil)
	m := NewMetaContextForTest(tc).WithUIs(uis)

	f := func(a libkb.LoginContext) error {
		m = m.WithLoginContext(a)
		if err := s.genPassphraseStream(m, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(m, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			return err
		}

		return s.fakeLKS(m)
	}
	if err := m.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPOnly"); err != nil {
		tc.T.Fatal(err)
	}

	// Generate a new test PGP key for the user, and specify the PushSecret
	// flag so that their triplesec'ed key is pushed to the server.
	gen := libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}
	gen.AddDefaultUID(tc.G)
	peng := NewPGPKeyImportEngine(tc.G, PGPKeyImportEngineArg{
		Gen:        &gen,
		PushSecret: true,
		Lks:        s.lks,
		NoSave:     true,
	})

	if err := RunEngine2(m, peng); err != nil {
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
	s := NewSignupEngine(tc.G, nil)
	uis := libkb.UIs{
		GPGUI:    &gpgPubOnlyTestUI{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	f := func(a libkb.LoginContext) error {
		m = m.WithLoginContext(a)
		if err := s.genPassphraseStream(m, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(m, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			return err
		}

		if err := s.fakeLKS(m); err != nil {
			return err
		}

		return s.addGPG(m, false, false)
	}
	if err := m.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPPubOnly"); err != nil {
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
	s := NewSignupEngine(tc.G, nil)
	uis := libkb.UIs{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	f := func(a libkb.LoginContext) error {
		m = m.WithLoginContext(a)
		if err := s.genPassphraseStream(m, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(m, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			t.Fatal(err)
		}

		fu.User = s.GetMe()

		// fake the lks:
		if err := s.fakeLKS(m); err != nil {
			return err
		}

		if err := s.addGPG(m, false, false); err != nil {
			return err
		}

		// hack the gpg ui to select a different key:
		m = m.WithGPGUI(&gpgtestui{index: 1})
		return s.addGPG(m, true, false)
	}

	if err := m.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPPubMult"); err != nil {
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
	s := NewSignupEngine(tc.G, nil)
	uis := libkb.UIs{
		GPGUI:    newGPGSelectEmailUI(tc.G, fu.Email),
		SecretUI: secui,
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	f := func(a libkb.LoginContext) error {
		m = m.WithLoginContext(a)
		if err := s.genPassphraseStream(m, fu.Passphrase); err != nil {
			return err
		}

		if err := s.join(m, fu.Username, fu.Email, libkb.TestInvitationCode, true); err != nil {
			t.Fatal(err)
		}

		fu.User = s.GetMe()

		// fake the lks:
		if err := s.fakeLKS(m); err != nil {
			return err
		}

		// this will add the GPG key for fu.Email to their account
		return s.addGPG(m, false, false)
	}

	if err := m.G().LoginState().ExternalFunc(f, "createFakeUserWithPGPMultSubset"); err != nil {
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
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
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
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
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
	}
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
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
	}
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

// fakeLKS is used to create a lks that has the server half when
// creating a fake user that doesn't have a device.
func (s *SignupEngine) fakeLKS(m libkb.MetaContext) error {
	s.lks = libkb.NewLKSec(s.ppStream, s.uid, m.G())
	return s.lks.GenerateServerHalf()
}
