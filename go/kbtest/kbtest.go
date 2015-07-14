package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
)

const testInviteCode = "202020202020202020202020"

type FakeUser struct {
	Username   string
	Email      string
	Passphrase string
	User       *libkb.User
}

func NewFakeUser(prefix string) (*FakeUser, error) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	username := fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@noemail.keybase.io", username)
	buf = make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	passphrase := hex.EncodeToString(buf)
	return &FakeUser{username, email, passphrase, nil}, nil
}

func (fu *FakeUser) NewSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func CreateAndSignupFakeUser(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	fu, err := NewFakeUser(prefix)
	if err != nil {
		return nil, err
	}
	arg := engine.SignupEngineRunArg{
		Username:   fu.Username,
		Email:      fu.Email,
		InviteCode: testInviteCode,
		Passphrase: fu.Passphrase,
		DeviceName: "my device",
		SkipGPG:    true,
		SkipMail:   true,
	}
	ctx := &engine.Context{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  libkb.TestLoginUI{Username: fu.Username},
	}
	s := engine.NewSignupEngine(&arg, g)
	if err := engine.RunEngine(s, ctx); err != nil {
		return nil, err
	}
	return fu, nil
}
