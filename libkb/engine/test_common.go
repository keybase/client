package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go/libkb"
	"testing"
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
	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}
	return fu
}

func (fu *FakeUser) Login() (err error) {
	larg := LoginEngineArg{
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
	err = li.Run(larg)
	return err
}

func (fu *FakeUser) LoginOrBust(t *testing.T) {
	if err := fu.Login(); err != nil {
		t.Fatal(err)
	}
	return
}
