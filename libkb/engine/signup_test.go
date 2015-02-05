package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func fakeUser(t *testing.T, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("%s@email.com", username)
	return username, email
}

func fakePassphrase(t *testing.T) string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(buf)
}

func TestSignupEngine(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	username, email := fakeUser(t, "se")
	passphrase := fakePassphrase(t)
	arg := SignupEngineRunArg{username, email, "202020202020202020202020", passphrase, "my device", true}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	G.LoginState.Logout()

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
		LogUI: G.UI.GetLogUI(),
	}
	li := NewLoginEngine()
	if err = li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}
	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	G.LoginState.Logout()

	if err = G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}

	sui := libkb.TestSecretUI{passphrase}
	if err = G.LoginState.PubkeyLogin(sui); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	G.LoginState.Logout()

	if err = G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}
}

func TestSignupWithGPG(t *testing.T) {
	tc := libkb.SetupTest(t, "signup with gpg")
	defer tc.Cleanup()

	username, email := fakeUser(t, "se")
	if err := tc.GenerateGPGKeyring(email); err != nil {
		t.Fatal(err)
	}
	passphrase := fakePassphrase(t)
	secui := &tsecretUI{t: t, kbpw: passphrase}
	s := NewSignupEngine(G.UI.GetLogUI(), &gpgtestui{}, secui)
	arg := SignupEngineRunArg{username, email, "202020202020202020202020", passphrase, "my device", false}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}
}

func TestLocalKeySecurity(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	username, email := fakeUser(t, "se")
	passphrase := fakePassphrase(t)
	arg := SignupEngineRunArg{username, email, "202020202020202020202020", passphrase, "my device", true}
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
	return fakePassphrase(u.t), nil
}
func (u *tsecretUI) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	return u.kbpw, nil
}
