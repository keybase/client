// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// TODO: These tests should really be in libkb/. However, any test
// that creates new users have to remain in engine/ for now. Fix this.

// Test that LoginState and Session are in sync regarding whether a
// user is logged in.
func TestLoginLogout(t *testing.T) {
	tc := SetupEngineTest(t, "login logout")
	defer tc.Cleanup()

	if err := AssertLoggedOut(tc); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	// Logging out when not logged in should still work.
	Logout(tc)

	fu := CreateAndSignupFakeUser(tc, "login")

	if err := AssertLoggedIn(tc); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	Logout(tc)

	if err := AssertLoggedOut(tc); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	// Logging out twice should still work.
	Logout(tc)

	if err := AssertLoggedOut(tc); err != nil {
		t.Error("Unexpectedly logged in (Session)")
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly logged in (LoginState)")
	}

	secretUI := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	if err := tc.G.LoginState().LoginWithPrompt("", nil, secretUI, nil); err != nil {
		t.Error(err)
	}

	if err := AssertLoggedIn(tc); err != nil {
		t.Error("Unexpectedly logged out (Session)")
	}

	if !LoggedIn(tc) {
		t.Error("Unexpectedly logged out (LoginState)")
	}
}

// This mock (and the similar ones below) may be used from a goroutine
// different from the main one, so don't mess with testing.T (which
// isn't safe to use from a non-main goroutine) directly, and instead
// have a LastErr field.
type GetPassphraseMock struct {
	Passphrase  string
	StoreSecret bool
	Called      bool
	LastErr     error
}

func (m *GetPassphraseMock) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	if m.Called {
		m.LastErr = errors.New("GetPassphrase unexpectedly called more than once")
		return res, m.LastErr
	}
	m.Called = true
	return keybase1.GetPassphraseRes{Passphrase: m.Passphrase, StoreSecret: m.StoreSecret}, nil
}

func (m *GetPassphraseMock) CheckLastErr(t *testing.T) {
	if m.LastErr != nil {
		t.Fatal(m.LastErr)
	}
}

// Test that login works while already logged in.
func TestLoginWhileAlreadyLoggedIn(t *testing.T) {
	tc := SetupEngineTest(t, "login while already logged in")
	defer tc.Cleanup()

	// Logs the user in.
	fu := CreateAndSignupFakeUser(tc, "li")

	// These should all work, since the username matches.

	if err := tc.G.LoginState().LoginWithPrompt("", nil, nil, nil); err != nil {
		t.Error(err)
	}

	if err := tc.G.LoginState().LoginWithPrompt(fu.Username, nil, nil, nil); err != nil {
		t.Error(err)
	}

	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err != nil {
		t.Error(err)
	}

	if err := tc.G.LoginState().LoginWithPassphrase(fu.Username, "", false, nil); err != nil {
		t.Error(err)
	}

	// This should fail.
	if _, ok := tc.G.LoginState().LoginWithPrompt("other", nil, nil, nil).(libkb.LoggedInWrongUserError); !ok {
		t.Fatal("Did not get expected LoggedIn error")
	}
}

// Test that login works while already logged in and after a login
// state reset.
func TestLoginAfterLoginStateReset(t *testing.T) {
	tc := SetupEngineTest(t, "login while already logged in")
	defer tc.Cleanup()

	// Logs the user in.
	_ = CreateAndSignupFakeUser(tc, "li")

	tc.ResetLoginState()

	if err := tc.G.LoginState().LoginWithPrompt("", nil, nil, nil); err != nil {
		t.Error(err)
	}
}

// Test that login fails with a nonexistent user.
func TestLoginNonexistent(t *testing.T) {
	tc := SetupEngineTest(t, "login nonexistent")
	defer tc.Cleanup()

	_ = CreateAndSignupFakeUser(tc, "ln")

	Logout(tc)

	secretUI := &libkb.TestSecretUI{Passphrase: "XXXXXXXXXXXX"}
	err := tc.G.LoginState().LoginWithPrompt("nonexistent", nil, secretUI, nil)
	if _, ok := err.(libkb.NotFoundError); !ok {
		t.Errorf("error type: %T, expected libkb.NotFoundError", err)
	}
}

type GetUsernameMock struct {
	Username string
	Called   bool
	LastErr  error
}

func (m *GetUsernameMock) GetEmailOrUsername(context.Context, int) (string, error) {
	if m.Called {
		m.LastErr = errors.New("GetEmailOrUsername unexpectedly called more than once")
		return "invalid username", m.LastErr
	}
	m.Called = true
	return m.Username, nil
}

func (m *GetUsernameMock) PromptRevokePaperKeys(_ context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return false, nil
}

func (m *GetUsernameMock) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}

func (m *GetUsernameMock) DisplayPrimaryPaperKey(_ context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}

func (m *GetUsernameMock) CheckLastErr(t *testing.T) {
	if m.LastErr != nil {
		t.Fatal(m.LastErr)
	}
}

// Test that the login falls back to a passphrase login if pubkey
// login fails.
func TestLoginWithPromptPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "login with prompt (passphrase)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "lwpp")

	Logout(tc)

	mockGetKeybasePassphrase := &GetPassphraseMock{
		Passphrase: fu.Passphrase,
	}
	if err := tc.G.LoginState().LoginWithPrompt("", nil, mockGetKeybasePassphrase, nil); err != nil {
		t.Error(err)
	}

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}

	Logout(tc)

	mockGetKeybasePassphrase.Called = false
	if err := tc.G.LoginState().LoginWithPrompt(fu.Username, nil, mockGetKeybasePassphrase, nil); err != nil {
		t.Error(err)
	}

	mockGetKeybasePassphrase.CheckLastErr(t)

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}

	Logout(tc)

	// Clear out the username stored in G.Env.
	tc.G.Env.GetConfigWriter().SetUserConfig(nil, true)

	mockGetUsername := &GetUsernameMock{
		Username: fu.Username,
	}
	mockGetKeybasePassphrase.Called = false
	if err := tc.G.LoginState().LoginWithPrompt("", mockGetUsername, mockGetKeybasePassphrase, nil); err != nil {
		t.Error(err)
	}

	mockGetUsername.CheckLastErr(t)
	mockGetKeybasePassphrase.CheckLastErr(t)

	if !mockGetUsername.Called {
		t.Errorf("loginUI.GetEmailOrUsername() unexpectedly not called")
	}

	if !mockGetKeybasePassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}
}

func userHasStoredSecretViaConfiguredAccounts(tc *libkb.TestContext, username string) bool {
	configuredAccounts, err := tc.G.GetConfiguredAccounts()
	if err != nil {
		tc.T.Error(err)
		return false
	}

	for _, configuredAccount := range configuredAccounts {
		if configuredAccount.Username == username {
			return configuredAccount.HasStoredSecret
		}
	}
	return false
}

func userHasStoredSecretViaSecretStore(tc *libkb.TestContext, username string) bool {
	secret, err := tc.G.SecretStoreAll.RetrieveSecret(libkb.NewNormalizedUsername(username))
	// TODO: Have RetrieveSecret return platform-independent errors
	// so that we can make sure we got the right one.
	return (!secret.IsNil() && err == nil)
}

func userHasStoredSecret(tc *libkb.TestContext, username string) bool {
	hasStoredSecret1 := userHasStoredSecretViaConfiguredAccounts(tc, username)
	hasStoredSecret2 := userHasStoredSecretViaSecretStore(tc, username)
	if hasStoredSecret1 != hasStoredSecret2 {
		tc.T.Errorf("user %s has stored secret via configured accounts = %t, but via secret store = %t", username, hasStoredSecret1, hasStoredSecret2)
	}
	return hasStoredSecret1
}

// Test that the login flow using the secret store works.
func TestLoginWithStoredSecret(t *testing.T) {

	tc := SetupEngineTest(t, "login with stored secret")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "lwss")
	Logout(tc)

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}

	mockGetPassphrase := &GetPassphraseMock{
		Passphrase:  fu.Passphrase,
		StoreSecret: true,
	}
	if err := tc.G.LoginState().LoginWithPrompt("", nil, mockGetPassphrase, nil); err != nil {
		t.Fatal(err)
	}

	mockGetPassphrase.CheckLastErr(t)

	if !mockGetPassphrase.Called {
		t.Errorf("secretUI.GetKeybasePassphrase() unexpectedly not called")
	}

	if !userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly does not have a stored secret", fu.Username)
	}

	// TODO: Mock out the SecretStore and make sure that it's
	// actually consulted.
	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err != nil {
		t.Error(err)
	}

	Logout(tc)

	if err := libkb.ClearStoredSecret(tc.G, fu.NormalizedUsername()); err != nil {
		t.Error(err)
	}

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}

	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err == nil {
		t.Error("Did not get expected error")
	}

	if err := tc.G.LoginState().LoginWithStoredSecret("", nil); err == nil {
		t.Error("Did not get expected error")
	}

	fu = CreateAndSignupFakeUser(tc, "lwss")
	Logout(tc)

	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err == nil {
		t.Error("Did not get expected error")
	}
}

// Test that the login flow with passphrase correctly denies bad
// usernames/passphrases.
func TestLoginWithPassphraseErrors(t *testing.T) {
	tc := SetupEngineTest(t, "login with passphrase (errors)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "lwpe")
	Logout(tc)

	err := tc.G.LoginState().LoginWithPassphrase("", "", false, nil)
	if _, ok := err.(libkb.AppStatusError); !ok {
		t.Error("Did not get expected AppStatusError")
	}

	err = tc.G.LoginState().LoginWithPassphrase(fu.Username, "wrong passphrase", false, nil)
	if _, ok := err.(libkb.PassphraseError); !ok {
		t.Error("Did not get expected PassphraseError")
	}
}

// Test that the login flow with passphrase but without saving the
// secret works.
func TestLoginWithPassphraseNoStore(t *testing.T) {

	tc := SetupEngineTest(t, "login with passphrase (no store)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "lwpns")
	Logout(tc)

	if err := tc.G.LoginState().LoginWithPassphrase(fu.Username, fu.Passphrase, false, nil); err != nil {
		t.Error(err)
	}

	Logout(tc)

	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err == nil {
		t.Error("Did not get expected error")
	}

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}
}

// Test that the login flow with passphrase and with saving the secret
// works.
func TestLoginWithPassphraseWithStore(t *testing.T) {

	tc := SetupEngineTest(t, "login with passphrase (with store)")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "lwpws")
	Logout(tc)

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}

	if err := tc.G.LoginState().LoginWithPassphrase(fu.Username, fu.Passphrase, true, nil); err != nil {
		t.Error(err)
	}

	if !userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly does not have a stored secret", fu.Username)
	}

	// TODO: Mock out the SecretStore and make sure that it's
	// actually consulted.
	if err := tc.G.LoginState().LoginWithStoredSecret(fu.Username, nil); err != nil {
		t.Error(err)
	}

	if err := libkb.ClearStoredSecret(tc.G, fu.NormalizedUsername()); err != nil {
		t.Error(err)
	}

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}
}

// TODO: Test LoginWithPassphrase with pubkey login failing.

// Signup followed by logout clears the stored secret
func TestSignupWithStoreThenLogout(t *testing.T) {
	tc := SetupEngineTest(t, "signup with store then login")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(tc.T, "lssl")

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}

	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = true
	_ = SignupFakeUserWithArg(tc, fu, arg)

	Logout(tc)

	if userHasStoredSecret(&tc, fu.Username) {
		t.Errorf("User %s unexpectedly has a stored secret", fu.Username)
	}
}
