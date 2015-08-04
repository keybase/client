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
	fu = &FakeUser{Username: username, Email: email, Passphrase: passphrase}
	return
}

func NewFakeUserOrBust(t *testing.T, prefix string) (fu *FakeUser) {
	var err error
	if fu, err = NewFakeUser(prefix); err != nil {
		t.Fatal(err)
	}
	return fu
}

const defaultDeviceName = "my device"

// MakeTestSignupEngineRunArg fills a SignupEngineRunArg with the most
// common parameters for testing and returns it.
func MakeTestSignupEngineRunArg(fu *FakeUser) SignupEngineRunArg {
	return SignupEngineRunArg{
		Username:    fu.Username,
		Email:       fu.Email,
		InviteCode:  testInviteCode,
		Passphrase:  fu.Passphrase,
		StoreSecret: false,
		DeviceName:  defaultDeviceName,
		SkipGPG:     true,
		SkipMail:    true,
	}
}

func CreateAndSignupFakeUser(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	arg := MakeTestSignupEngineRunArg(fu)
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

	arg := MakeTestSignupEngineRunArg(fu)
	ctx := &Context{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, g)
	err = RunEngine(s, ctx)
	if err != nil {
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
	li := NewLoginWithPromptEngine(fu.Username, g)
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

func (fu *FakeUser) NewSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func AssertLoggedIn(tc libkb.TestContext) error {
	if err := checkLocalSession(tc); err != nil {
		return err
	}
	if !LoggedIn(tc) {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertLoggedOut(tc libkb.TestContext) error {
	if err := checkLocalSession(tc); err != nil {
		return err
	}
	if LoggedIn(tc) {
		return libkb.LogoutError{}
	}
	return nil
}

func checkLocalSession(tc libkb.TestContext) error {
	var err error
	aerr := tc.G.LoginState().LocalSession(func(s *libkb.Session) {
		err = s.Check()
	}, "engine test - checkLocalSession")
	if aerr != nil {
		return aerr
	}
	return err
}

func LoggedIn(tc libkb.TestContext) bool {
	return tc.G.LoginState().LoggedIn()
}

func Logout(tc libkb.TestContext) {
	if err := tc.G.Logout(); err != nil {
		tc.T.Fatalf("logout error: %s", err)
	}
}

// TODO: Add tests that use testEngineWithSecretStore for every engine
// that should work with the secret store.

// testEngineWithSecretStore takes a given engine-running function and
// makes sure that it works with the secret store, i.e. that it stores
// data into it when told to and reads data out from it.
func testEngineWithSecretStore(
	t *testing.T,
	runEngine func(libkb.TestContext, *FakeUser, libkb.SecretUI)) {
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "wss")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "wss")
	tc.ResetLoginState()

	testSecretUI := libkb.TestSecretUI{
		Passphrase:  fu.Passphrase,
		StoreSecret: true,
	}
	runEngine(tc, fu, &testSecretUI)

	if !testSecretUI.CalledGetSecret {
		t.Fatal("GetSecret() unexpectedly not called")
	}

	tc.ResetLoginState()

	testSecretUI = libkb.TestSecretUI{}
	runEngine(tc, fu, &testSecretUI)

	if testSecretUI.CalledGetSecret {
		t.Fatal("GetSecret() unexpectedly called")
	}
}
