package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func SetupEngineTest(tb testing.TB, name string) libkb.TestContext {
	tc := libkb.SetupTest(tb, name)
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

func (fu FakeUser) NormalizedUsername() libkb.NormalizedUsername {
	return libkb.NewNormalizedUsername(fu.Username)
}

func NewFakeUserOrBust(tb testing.TB, prefix string) (fu *FakeUser) {
	var err error
	if fu, err = NewFakeUser(prefix); err != nil {
		tb.Fatal(err)
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

func SignupFakeUserWithArg(tc libkb.TestContext, fu *FakeUser, arg SignupEngineRunArg) *SignupEngine {
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
	return s
}

func CreateAndSignupFakeUser(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	arg := MakeTestSignupEngineRunArg(fu)
	_ = SignupFakeUserWithArg(tc, fu, arg)
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

func CreateAndSignupFakeUserGPG(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		tc.T.Fatal(err)
	}
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipGPG = false
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

func CreateAndSignupFakeUserCustomArg(tc libkb.TestContext, prefix string, fmod func(*SignupEngineRunArg)) (*FakeUser, libkb.GenericKey) {
	fu := NewFakeUserOrBust(tc.T, prefix)
	arg := MakeTestSignupEngineRunArg(fu)
	fmod(&arg)
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
	return fu, s.signingKey
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

func AssertProvisioned(tc libkb.TestContext) error {
	prov, err := tc.G.LoginState().LoggedInProvisionedLoad()
	if err != nil {
		return err
	}
	if !prov {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertLoggedIn(tc libkb.TestContext) error {
	if !LoggedIn(tc) {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertLoggedOut(tc libkb.TestContext) error {
	if LoggedIn(tc) {
		return libkb.LogoutError{}
	}
	return nil
}

func LoggedIn(tc libkb.TestContext) bool {
	lin, _ := tc.G.LoginState().LoggedInLoad()
	return lin
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
