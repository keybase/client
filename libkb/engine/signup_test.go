package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func fakeUser(t *testing.T, prefix string) (fu *libkb.FakeUser) {
	var err error
	if fu, err = libkb.NewFakeUser(prefix); err != nil {
		t.Fatal(err)
	}
	return
}

func AssertDeviceID() (err error) {
	if G.Env.GetDeviceID() == nil {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	fu := fakeUser(t, "se")
	arg := SignupEngineRunArg{fu.Username, fu.Email, "202020202020202020202020", fu.Passphrase, "my device", true}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	G.LoginState.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   fu.Username,
			Passphrase: fu.Passphrase,
			NoUi:       true,
		},
		LogUI: G.UI.GetLogUI(),
	}
	li := NewLoginEngine()
	if err = li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	G.LoginState.Logout()

	if err = G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}

	sui := libkb.TestSecretUI{fu.Passphrase}
	if err = G.LoginState.PubkeyLogin(sui); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	G.LoginState.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}
}

func TestSignupWithGPG(t *testing.T) {
	tc := libkb.SetupTest(t, "signupWithGPG")
	defer tc.Cleanup()

	fu := fakeUser(t, "se")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}
	secui := &tsecretUI{t: t, kbpw: fu.Passphrase}
	s := NewSignupEngine(G.UI.GetLogUI(), &gpgtestui{}, secui)
	arg := SignupEngineRunArg{fu.Username, fu.Email, "202020202020202020202020", fu.Passphrase, "my device", false}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}
}

func TestLocalKeySecurity(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	fu := fakeUser(t, "se")
	arg := SignupEngineRunArg{fu.Username, fu.Email, "202020202020202020202020", fu.Passphrase, "my device", true}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}

	ch := s.tspkey.LksClientHalf()

	lks := libkb.NewLKSecClientHalf(ch)
	err = lks.Load()
	if err != nil {
		t.Fatal(err)
	}

	text := "the people on the bus go up and down, up and down, up and down"
	enc, err := lks.Encrypt([]byte(text))
	if err != nil {
		t.Fatal(err)
	}

	dec, err := lks.Decrypt(enc)
	if err != nil {
		t.Fatal(err)
	}
	if string(dec) != text {
		t.Errorf("decrypt: %q, expected %q", string(dec), text)
	}
}

type tsecretUI struct {
	t    *testing.T
	kbpw string
}

func (u *tsecretUI) GetSecret(pinentry keybase_1.SecretEntryArg, terminal *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	return nil, nil
}
func (u *tsecretUI) GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error) {
	return u.kbpw, nil
}
func (u *tsecretUI) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	return u.kbpw, nil
}
