// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"runtime"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func AssertDeviceID(g *libkb.GlobalContext) (err error) {
	if g.Env.GetDeviceID().IsNil() {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	subTestSignupEngine(t, false)
}

func subTestSignupEngine(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	if me.GetEldestKID().IsNil() {
		t.Fatal("after signup, eldest kid is nil")
	}

	// Now try to logout and log back in
	Logout(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err := AssertLoggedOut(tc); err != nil {
		t.Fatal(err)
	}

	fu.LoginOrBust(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	Logout(tc)

	if err := AssertLoggedOut(tc); err != nil {
		t.Fatal(err)
	}

	secretUI := fu.NewSecretUI()
	err = fu.LoginWithSecretUI(secretUI, tc.G)
	if err != nil {
		t.Fatal(err)
	}

	if !secretUI.CalledGetPassphrase {
		t.Errorf("secretUI.GetKeybasePassphrase() not called")
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	Logout(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedOut(tc); err != nil {
		t.Fatal(err)
	}
}

// Test that after signing up the used User object has their first per-user-key
// locall delegated.
func TestSignupLocalDelegatePerUserKey(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	_, signupEngine := CreateAndSignupFakeUser2(tc, "se")

	u := signupEngine.GetMe()
	require.NotNil(t, u, "no user from signup engine")
	puk := u.GetComputedKeyFamily().GetLatestPerUserKey()
	require.NotNil(t, puk, "no local per-user-key")
	require.Equal(t, 1, puk.Gen)
}

func TestSignupWithGPG(t *testing.T) {
	tc := SetupEngineTest(t, "signupWithGPG")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(t, "se")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipGPG = false
	s := NewSignupEngine(tc.G, &arg)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	if err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s); err != nil {
		t.Fatal(err)
	}
}

func TestLocalKeySecurity(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "se")
	arg := MakeTestSignupEngineRunArg(fu)
	s := NewSignupEngine(tc.G, &arg)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	if err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s); err != nil {
		t.Fatal(err)
	}

	m := NewMetaContextForTest(tc)
	lks := libkb.NewLKSec(s.ppStream, s.uid)
	if err := lks.Load(m); err != nil {
		t.Fatal(err)
	}

	text := "the people on the bus go up and down, up and down, up and down"
	enc, err := lks.Encrypt(m, []byte(text))
	if err != nil {
		t.Fatal(err)
	}

	dec, _, _, err := lks.Decrypt(m, enc)
	if err != nil {
		t.Fatal(err)
	}
	if string(dec) != text {
		t.Errorf("decrypt: %q, expected %q", string(dec), text)
	}
}

// Test that the signup engine stores the secret correctly when
// StoreSecret is set.
func TestLocalKeySecurityStoreSecret(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "se")

	secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
	if secretStore == nil {
		t.Skip("No SecretStore on this platform")
	}

	_, err := secretStore.RetrieveSecret(NewMetaContextForTest(tc))
	if err == nil {
		t.Fatal("User unexpectedly has secret")
	}

	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = true
	s := SignupFakeUserWithArg(tc, fu, arg)

	m := NewMetaContextForTest(tc)
	secret, err := s.lks.GetSecret(m)
	if err != nil {
		t.Fatal(err)
	}

	storedSecret, err := secretStore.RetrieveSecret(NewMetaContextForTest(tc))
	if err != nil {
		t.Error(err)
	}

	if !secret.Equal(storedSecret) {
		t.Errorf("Expected %v, got %v", secret, storedSecret)
	}

	err = tc.G.SecretStore().ClearSecret(NewMetaContextForTest(tc), fu.NormalizedUsername())
	if err != nil {
		t.Error(err)
	}
}

func TestIssue280(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	// Initialize state with user U1
	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)
	Logout(tc)

	// Now try to sign in as user U2, and do something
	// that needs access to a locked local secret key.
	// Delegating to a new PGP key seems good enough.
	u2 := CreateAndSignupFakeUser(tc, "login")

	secui := u2.NewSecretUI()
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != nil {
		t.Fatal(err)
	}
}

func TestSignupGeneratesPaperKey(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "se")
	hasOnePaperDev(tc, fu)
}

func TestSignupPassphrases(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	CreateAndSignupFakeUserWithPassphrase(tc, "pass", "123456789012")
	CreateAndSignupFakeUserWithPassphrase(tc, "pass", "12345678")
}

func TestSignupShortPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(t, "sup")
	fu.Passphrase = "1234567"
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	arg := MakeTestSignupEngineRunArg(fu)
	t.Logf("signup arg: %+v", arg)
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err == nil {
		t.Fatal("signup worked with short passphrase")
	}
	if _, ok := err.(libkb.PassphraseError); !ok {
		t.Fatalf("error type: %T, expected libkb.PassphraseError", err)
	}
}

func TestSignupNonAsciiDeviceName(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	testValues := []struct {
		deviceName string
		err        error
	}{
		{"perfectly-reasonable", nil},
		{"definitely🙃not🐉ascii", libkb.DeviceBadNameError{}},
	}

	for _, testVal := range testValues {
		fu, _ := NewFakeUser("sup")
		arg := MakeTestSignupEngineRunArg(fu)
		arg.DeviceName = testVal.deviceName
		_, err := CreateAndSignupFakeUserSafeWithArg(tc.G, fu, arg)
		require.IsType(t, err, testVal.err)
	}
}

func TestSignupNOPWBadParams(t *testing.T) {
	tc := SetupEngineTest(t, "signup_nopw")
	defer tc.Cleanup()

	fu, _ := NewFakeUser("sup")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = false
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	_, err := CreateAndSignupFakeUserSafeWithArg(tc.G, fu, arg)
	require.Error(t, err)

	// Make sure user has not signed up - the engine should fail before running
	// signup_join.
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username).WithPublicKeyOptional()
	_, err = libkb.LoadUser(loadArg)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
}

func TestSignupWithoutSecretStore(t *testing.T) {
	tc := SetupEngineTest(t, "signup_nopw")
	defer tc.Cleanup()

	// Setup memory-only secret store.
	libkb.ReplaceSecretStoreForTests(tc, "" /* dataDir */)

	fu, _ := NewFakeUser("sup")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = true
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	_, err := CreateAndSignupFakeUserSafeWithArg(tc.G, fu, arg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "persistent secret store is required")

	// Make sure user has not signed up - the engine should fail before running
	// signup_join.
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username).WithPublicKeyOptional()
	_, err = libkb.LoadUser(loadArg)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
}

func TestSignupWithBadSecretStore(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("this test uses chmod, skipping on Windows")
	}

	tc := SetupEngineTest(t, "signup_nopw")
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	// Create a secret store that's read only - even though
	// secret store exists, secrets cannot be stored.
	td, cleanup := libkb.CreateReadOnlySecretStoreDir(tc)
	defer cleanup()
	libkb.ReplaceSecretStoreForTests(tc, td)

	fu, _ := NewFakeUser("sup")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = true
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	_, err := CreateAndSignupFakeUserSafeWithArg(tc.G, fu, arg)
	require.Error(t, err)
	require.IsType(t, SecretStoreNotFunctionalError{}, err)
	require.Contains(t, err.Error(), "permission denied")

	// Make sure user has not signed up - the engine should fail before running
	// signup_join.
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username).WithPublicKeyOptional()
	_, err = libkb.LoadUser(loadArg)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
}
