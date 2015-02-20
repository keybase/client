package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
)

var testInviteCode string = "202020202020202020202020"

type FakeUser struct {
	Username   string
	Email      string
	Passphrase string
}

func NewFakeUser(prefix string) (fu *FakeUser, err error) {
	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	username := fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@email.com", username)
	buf = make([]byte, 12)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	passphrase := hex.EncodeToString(buf)
	fu = &FakeUser{username, email, passphrase}
	return
}

func NewFakeUserOrBust(t *testing.T, prefix string) (fu *FakeUser) {
	var err error
	if fu, err = NewFakeUser(prefix); err != nil {
		t.Fatal(err)
	}
	return fu
}

func CreateAndSignupFakeUser(t *testing.T, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(t, prefix)
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	ctx := &Context{
		LogUI:    G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: libkb.TestSecretUI{fu.Passphrase},
		LoginUI:  libkb.TestLoginUI{fu.Username},
		KeyGenUI: &libkb.TestKeyGenUI{},
	}
	s := NewSignupEngine()
	err := RunEngine(s, ctx, arg, nil)
	if err != nil {
		t.Fatal(err)
	}
	return fu
}

func (fu *FakeUser) Login() error {
	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   fu.Username,
			Passphrase: fu.Passphrase,
			NoUi:       true,
		},
	}
	secui := libkb.TestSecretUI{fu.Passphrase}
	li := NewLoginEngine()
	ctx := &Context{
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: &ldocui{},
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LoginUI:  &libkb.TestLoginUI{},
	}
	return RunEngine(li, ctx, larg, nil)
}

func (fu *FakeUser) LoginOrBust(t *testing.T) {
	if err := fu.Login(); err != nil {
		t.Fatal(err)
	}
	return
}
