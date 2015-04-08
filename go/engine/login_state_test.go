package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// TODO: These tests should really be in libkb/. However, any test
// that creates new users have to remain in engine/ for now. Fix this.

// Test that LoginState and Session are in sync regarding whether a
// user is logged in.
func TestLoginLogout(t *testing.T) {
	tc := SetupEngineTest(t, "login logout")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	// TODO: LoginState still thinks we're logged out here. Fix this?

	G.LoginState.Logout()

	if err := G.Session.AssertLoggedOut(); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	secretUI := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := libkb.LoginArg{
		Prompt:   true,
		SecretUI: secretUI,
	}
	if err := G.LoginState.Login(arg); err != nil {
		t.Error(err)
	}

	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	if !G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged out (LoginState)")
	}
}

type GetSecretMock struct {
	Passphrase string
	Called     bool
	T          *testing.T
}

func (m *GetSecretMock) GetSecret(keybase_1.SecretEntryArg, *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	if m.Called {
		m.T.Fatal("GetSecret unexpectedly called more than once")
		return nil, nil
	}
	m.Called = true
	return &keybase_1.SecretEntryRes{Text: m.Passphrase}, nil
}

func (m *GetSecretMock) GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error) {
	m.T.Fatal("GetNewPassphrase unexpectedly called")
	return "", nil
}

func (m *GetSecretMock) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	m.T.Fatal("GetKeybasePassphrase unexpectedly called")
	return "", nil
}

// Test that the login prompts for a passphrase for the pubkey first.
func TestLoginWithPromptPubkey(t *testing.T) {
	tc := SetupEngineTest(t, "login with prompt (pubkey)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwpp")

	G.LoginState.Logout()

	mockGetSecret := &GetSecretMock{
		Passphrase: fu.Passphrase,
		T:          t,
	}
	arg := libkb.LoginArg{
		Prompt:   true,
		SecretUI: mockGetSecret,
	}
	if err := G.LoginState.Login(arg); err != nil {
		t.Error(err)
	}

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}
}
