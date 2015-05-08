package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func SetupEngineTest(t *testing.T, name string) libkb.TestContext {
	tc := libkb.SetupTest(t, name)
	// G = libkb.G
	return tc
}

var testInviteCode = "202020202020202020202020"

type FakeUser struct {
	Username   string
	Email      string
	Passphrase string
	User       *libkb.User
}

func NewFakeUser(prefix string) (fu *FakeUser, err error) {
	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	username := fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@noemail.keybase.io", username)
	buf = make([]byte, 12)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	passphrase := hex.EncodeToString(buf)
	fu = &FakeUser{username, email, passphrase, nil}
	return
}

func NewFakeUserOrBust(t *testing.T, prefix string) (fu *FakeUser) {
	var err error
	if fu, err = NewFakeUser(prefix); err != nil {
		t.Fatal(err)
	}
	return fu
}

func CreateAndSignupFakeUser(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

func CreateAndSignupFakeUserSafe(g *libkb.GlobalContext, prefix string) (*FakeUser, error) {
	fu, err := NewFakeUser(prefix)
	if err != nil {
		return nil, err
	}
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	ctx := &Context{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, g)
	if err := RunEngine(s, ctx); err != nil {
		return nil, err
	}
	return fu, nil
}

func (fu *FakeUser) LoginWithSecretUI(secui libkb.SecretUI, g *libkb.GlobalContext) error {
	ctx := &Context{
		LogUI:       g.UI.GetLogUI(),
		LocksmithUI: &lockui{},
		GPGUI:       &gpgtestui{},
		SecretUI:    secui,
		LoginUI:     &libkb.TestLoginUI{},
	}
	li := NewLoginWithPromptEngine(fu.Username)
	return RunEngine(li, ctx)
}

func (fu *FakeUser) Login(g *libkb.GlobalContext) error {
	return fu.LoginWithSecretUI(fu.NewSecretUI(), g)
}

func (fu *FakeUser) LoginOrBust(tc libkb.TestContext) {
	if err := fu.Login(tc.G); err != nil {
		tc.T.Fatal(err)
	}
}

func (fu *FakeUser) NewSecretUI() libkb.TestSecretUI {
	return libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func AssertLoggedIn(tc libkb.TestContext) error {
	if err := tc.G.Account().LocalSession().Check(); err != nil {
		return err
	}
	if !tc.G.Account().LocalSession().IsLoggedIn() {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertLoggedOut(tc libkb.TestContext) error {
	if err := tc.G.Account().LocalSession().Check(); err != nil {
		return err
	}
	if tc.G.Account().LocalSession().IsLoggedIn() {
		return libkb.LogoutError{}
	}
	return nil
}
