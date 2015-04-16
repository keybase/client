package engine

import (
	"errors"
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

	if err := G.LoginState.AssertLoggedOut(); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	// Logging out when not logged in should still work.
	G.LoginState.Logout()

	fu := CreateAndSignupFakeUser(t, "login")

	if err := G.LoginState.AssertLoggedIn(); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	G.LoginState.Logout()

	if err := G.LoginState.AssertLoggedOut(); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	// Logging out twice should still work.
	G.LoginState.Logout()

	if err := G.LoginState.AssertLoggedOut(); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	secretUI := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	if err := G.LoginState.LoginWithPrompt("", nil, secretUI); err != nil {
		t.Error(err)
	}

	if err := G.LoginState.AssertLoggedIn(); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	if !G.LoginState.IsLoggedIn() {
		t.Error("Unexpectedly logged out (LoginState)")
	}
}

type GetSecretMock struct {
	Passphrase  string
	StoreSecret bool
	Called      bool
	T           *testing.T
}

func (m *GetSecretMock) GetSecret(arg keybase_1.SecretEntryArg, _ *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	if m.Called {
		m.T.Fatal("GetSecret unexpectedly called more than once")
	}
	m.Called = true
	storeSecret := arg.UseSecretStore && m.StoreSecret
	return &keybase_1.SecretEntryRes{Text: m.Passphrase, StoreSecret: storeSecret}, nil
}

func (m *GetSecretMock) GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error) {
	m.T.Fatal("GetNewPassphrase unexpectedly called")
	return "", nil
}

func (m *GetSecretMock) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	m.T.Fatal("GetKeybasePassphrase unexpectedly called")
	return "", nil
}

// Test that login works while already logged in.
func TestLoginWhileAlreadyLoggedIn(t *testing.T) {
	tc := SetupEngineTest(t, "login while already logged in")
	defer tc.Cleanup()

	// Logs the user in.
	fu := CreateAndSignupFakeUser(t, "li")

	// These should all work, since the username matches.

	if err := G.LoginState.LoginWithPrompt("", nil, nil); err != nil {
		t.Error(err)
	}

	if err := G.LoginState.LoginWithPrompt(fu.Username, nil, nil); err != nil {
		t.Error(err)
	}

	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err != nil {
		t.Error(err)
	}

	if err := G.LoginState.LoginWithPassphrase(fu.Username, "", false); err != nil {
		t.Error(err)
	}

	// This should fail.
	if _, ok := G.LoginState.LoginWithPrompt("other", nil, nil).(libkb.LoggedInError); !ok {
		t.Fatal("Did not get expected LoggedIn error")
	}
}

// Test that login fails with a nonexistent user.
func TestLoginNonexistent(t *testing.T) {
	tc := SetupEngineTest(t, "login nonexistent")
	defer tc.Cleanup()

	_ = CreateAndSignupFakeUser(t, "ln")

	G.LoginState.Logout()

	err := G.LoginState.LoginWithPrompt("nonexistent", nil, nil)
	if _, ok := err.(libkb.AppStatusError); !ok {
		t.Error("Did not get expected AppStatusError")
	}
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
	if err := G.LoginState.LoginWithPrompt("", nil, mockGetSecret); err != nil {
		t.Error(err)
	}

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	G.LoginState.Logout()

	mockGetSecret.Called = false
	if err := G.LoginState.LoginWithPrompt(fu.Username, nil, mockGetSecret); err != nil {
		t.Error(err)
	}

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	// The interaction with the loginUI is covered by
	// TestLoginWithPromptPassphrase below.
}

type GetUsernameMock struct {
	Username string
	Called   bool
	T        *testing.T
}

func (m *GetUsernameMock) GetEmailOrUsername(int) (string, error) {
	if m.Called {
		m.T.Fatal("GetEmailOrUsername unexpectedly called more than once")
	}
	m.Called = true
	return m.Username, nil
}

type GetKeybasePassphraseMock struct {
	Passphrase string
	Called     bool
	T          *testing.T
}

func (m *GetKeybasePassphraseMock) GetSecret(keybase_1.SecretEntryArg, *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	return nil, errors.New("Fail pubkey login")
}

func (m *GetKeybasePassphraseMock) GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error) {
	m.T.Fatal("GetNewPassphrase unexpectedly called")
	return "", nil
}

func (m *GetKeybasePassphraseMock) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	if m.Called {
		m.T.Fatal("GetKeybasePassphrase unexpectedly called more than once")
	}
	m.Called = true
	return m.Passphrase, nil
}

// Test that the login falls back to a passphrase login if pubkey
// login fails.
func TestLoginWithPromptPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "login with prompt (passphrase)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwpp")

	G.LoginState.Logout()

	mockGetKeybasePassphrase := &GetKeybasePassphraseMock{
		Passphrase: fu.Passphrase,
		T:          t,
	}
	if err := G.LoginState.LoginWithPrompt("", nil, mockGetKeybasePassphrase); err != nil {
		t.Error(err)
	}

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}

	G.LoginState.Logout()

	mockGetKeybasePassphrase.Called = false
	if err := G.LoginState.LoginWithPrompt(fu.Username, nil, mockGetKeybasePassphrase); err != nil {
		t.Error(err)
	}

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}

	G.LoginState.Logout()

	// Clear out the username stored in G.Env.
	// TODO: Figure out a cleaner way to do this.
	G.Env = libkb.NewEnv(nil, nil)

	mockGetUsername := &GetUsernameMock{
		Username: fu.Username,
		T:        t,
	}
	mockGetKeybasePassphrase.Called = false
	if err := G.LoginState.LoginWithPrompt("", mockGetUsername, mockGetKeybasePassphrase); err != nil {
		t.Error(err)
	}

	if !mockGetUsername.Called {
		t.Errorf("loginUI.GetEmailOrUsername() unexpectedly not called")
	}

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}
}

// Test that the login flow using the secret store works.
func TestLoginWithStoredSecret(t *testing.T) {
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "login with stored secret")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwss")
	G.LoginState.Logout()

	mockGetSecret := &GetSecretMock{
		Passphrase:  fu.Passphrase,
		StoreSecret: true,
		T:           t,
	}
	if err := G.LoginState.LoginWithPrompt("", nil, mockGetSecret); err != nil {
		t.Error(err)
	}

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	G.LoginState.Logout()

	// TODO: Mock out the SecretStore and make sure that it's
	// actually consulted.
	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err != nil {
		t.Error(err)
	}

	G.LoginState.Logout()

	G.LoginState.ClearStoredSecret(fu.Username)

	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err == nil {
		t.Error("Did not get expected error")
	}

	if err := G.LoginState.LoginWithStoredSecret(""); err == nil {
		t.Error("Did not get expected error")
	}

	fu = CreateAndSignupFakeUser(t, "lwss")
	G.LoginState.Logout()

	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err == nil {
		t.Error("Did not get expected error")
	}
}

// Test that the login flow with passphrase correctly denies bad
// usernames/passphrases.
func TestLoginWithPassphraseErrors(t *testing.T) {
	tc := SetupEngineTest(t, "login with passphrase (errors)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwpe")
	G.LoginState.Logout()

	err := G.LoginState.LoginWithPassphrase("", "", false)
	if _, ok := err.(libkb.AppStatusError); !ok {
		t.Error("Did not get expected AppStatusError")
	}

	err = G.LoginState.LoginWithPassphrase(fu.Username, "wrong passphrase", false)
	if _, ok := err.(libkb.PassphraseError); !ok {
		t.Error("Did not get expected PassphraseError")
	}
}

// Test that the login flow with passphrase but without saving the
// secret works.
func TestLoginWithPassphraseNoStore(t *testing.T) {
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "login with passphrase (no store)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwpns")
	G.LoginState.Logout()

	if err := G.LoginState.LoginWithPassphrase(fu.Username, fu.Passphrase, false); err != nil {
		t.Error(err)
	}

	G.LoginState.Logout()

	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err == nil {
		t.Error("Did not get expected error")
	}
}

// Test that the login flow with passphrase and with saving the secret
// works.
func TestLoginWithPassphraseWithStore(t *testing.T) {
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "login with passphrase (with store)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "lwpws")
	G.LoginState.Logout()

	if err := G.LoginState.LoginWithPassphrase(fu.Username, fu.Passphrase, true); err != nil {
		t.Error(err)
	}

	G.LoginState.Logout()

	// TODO: Mock out the SecretStore and make sure that it's
	// actually consulted.
	if err := G.LoginState.LoginWithStoredSecret(fu.Username); err != nil {
		t.Error(err)
	}

	G.LoginState.ClearStoredSecret(fu.Username)
}

// TODO: Test LoginWithPassphrase with pubkey login failing.
