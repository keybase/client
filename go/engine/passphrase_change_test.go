// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func withNewProvisionalLoginForFakeUser(m libkb.MetaContext, u *FakeUser) libkb.MetaContext {
	m = m.WithNewProvisionalLoginContextForUserVersionAndUsername(u.UserVersion(), libkb.NewNormalizedUsername(u.Username))
	return m
}

func tryPassphrase(tc libkb.TestContext, u *FakeUser, pp string) error {
	m := NewMetaContextForTest(tc)
	m = withNewProvisionalLoginForFakeUser(m, u)
	_, err := libkb.VerifyPassphraseGetStreamInLoginContext(m, pp)
	return err
}

func verifyPassphraseChange(tc libkb.TestContext, u *FakeUser, newPassphrase string) {
	err := tryPassphrase(tc, u, newPassphrase)
	require.NoError(tc.T, err, "verified new passphrase works")
	err = tryPassphrase(tc, u, u.Passphrase)
	require.Error(tc.T, err, "verified old passphrase fails")
	if testing.Verbose() {
		fmt.Printf("browser test -- username:  %s    password:  %s\n", u.Username, newPassphrase)
	}
}

func assertLoadSecretKeys(tc libkb.TestContext, u *FakeUser, msg string) {
	tc.G.Log.Debug("In assertLoadSecretKeys")

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	if me == nil {
		tc.T.Fatalf("%s: nil LoadMe result", msg)
	}
	skarg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	parg := libkb.SecretKeyPromptArg{
		Ska:      skarg,
		SecretUI: u.NewSecretUI(),
		Reason:   "testing sig",
	}
	m := NewMetaContextForTest(tc)
	m = withNewProvisionalLoginForFakeUser(m, u)

	tc.G.Log.Debug("doing a silent passphrase login for session token")
	err = libkb.PassphraseLoginNoPrompt(m, u.Username, u.Passphrase)
	require.NoError(tc.T, err)

	tc.G.Log.Debug("Calling GetSecretKeyWithPrompt (for signing)")
	sigKey, err := tc.G.Keyrings.GetSecretKeyWithPrompt(m, parg)
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	if sigKey == nil {
		tc.T.Fatalf("%s: got nil signing key", msg)
	}

	parg.Ska.KeyType = libkb.DeviceEncryptionKeyType
	tc.G.Log.Debug("Calling GetSecretKeyWithPrompt (for encryption)")
	encKey, err := tc.G.Keyrings.GetSecretKeyWithPrompt(m, parg)
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	if encKey == nil {
		tc.T.Fatalf("%s: got nil encryption key", msg)
	}
}

func assertLoadPGPKeys(tc libkb.TestContext, u *FakeUser) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.PGPKeyType,
	}
	parg := libkb.SecretKeyPromptArg{
		Ska:      ska,
		SecretUI: u.NewSecretUI(),
		Reason:   "pgp test",
	}
	m := NewMetaContextForTest(tc)
	key, err := tc.G.Keyrings.GetSecretKeyWithPrompt(m, parg)
	if err != nil {
		tc.T.Fatal(err)
	}

	var ok bool
	_, ok = key.(*libkb.PGPKeyBundle)
	if !ok {
		tc.T.Errorf("key type: %T, expected libkb.PGPKeyBundle", key)
	}
}

// Test changing the passphrase when user knows current
// passphrase.
func TestPassphraseChangeKnown(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		OldPassphrase: u.Passphrase,
		Passphrase:    newPassphrase,
	}

	// using an empty secret ui to make sure existing pp doesn't come from ui prompt:
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change known")
}

// Test error when trying to change passphrase to shorter than 6
// chars long.
func TestPassphraseChangeShort(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "pass"
	arg := &keybase1.PassphraseChangeArg{
		OldPassphrase: u.Passphrase,
		Passphrase:    newPassphrase,
	}
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err == nil {
		t.Fatal("expected error with new short passphrase")
	}
	if _, ok := err.(libkb.PassphraseError); !ok {
		t.Fatalf("expected libkb.PassphraseError, got %T", err)
	}
}

// Test changing the passphrase when user knows current
// passphrase, prompt for it.
func TestPassphraseChangeKnownPrompt(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	clearCaches(tc.G)

	// Test changing passphrase 3 times; so that old passphrase
	// cache is properly busted.
	newPassphrase := "password1234"
	numChanges := 3
	for i := 0; i < numChanges; i++ {

		arg := &keybase1.PassphraseChangeArg{
			Passphrase: newPassphrase,
		}
		secui := u.NewSecretUI()
		uis := libkb.UIs{
			SecretUI: secui,
		}
		eng := NewPassphraseChange(tc.G, arg)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
			t.Fatal(err)
		}

		// We only call this the last time through, since internally,
		// verifyPassphraseChange calls ClearStreamCache(), which is
		// the bug fix that we're actually trying to test by doing multiple
		// passphrase changes.
		if i == numChanges-1 {
			verifyPassphraseChange(tc, u, newPassphrase)
		}

		if !secui.CalledGetPassphrase {
			t.Errorf("get passphrase not called")
		}

		u.Passphrase = newPassphrase
		assertLoadSecretKeys(tc, u, "passphrase change known prompt")
		newPassphrase += "-xo"
	}
}

// Test changing the passphrase when user knows current
// passphrase, prompt for it.
func TestPassphraseChangeKnownPromptRepeatOld(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	m := NewMetaContextForTest(tc)

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	m.ActiveDevice().ClearCaches()

	// Test changing passphrase 3 times; so that old passphrase
	// cache is properly busted.
	newPassphrase := "password1234"
	numChanges := 3
	for i := 0; i < numChanges; i++ {

		arg := &keybase1.PassphraseChangeArg{
			Passphrase: newPassphrase,
		}
		secui := u.NewSecretUI()
		uis := libkb.UIs{
			SecretUI: secui,
		}
		eng := NewPassphraseChange(tc.G, arg)
		m = m.WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
			t.Fatal(err)
		}

		// We only call this the last time through, since internally,
		// verifyPassphraseChange calls ClearStreamCache(), which is
		// the bug fix that we're actually trying to test by doing multiple
		// passphrase changes.
		if i == numChanges-1 {
			m := NewMetaContextForTest(tc)
			_, err := libkb.VerifyPassphraseForLoggedInUser(m, newPassphrase)
			if err != nil {
				t.Fatal(err)
			}
		}

		if !secui.CalledGetPassphrase {
			t.Errorf("get passphrase not called")
		}

		u.Passphrase = newPassphrase
		assertLoadSecretKeys(tc, u, "passphrase change known prompt")
	}
}

// Test changing the passphrase after logging in via pubkey.
func TestPassphraseChangeAfterPubkeyLogin(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// this should do a pubkey login
	Logout(tc)

	secui := u.NewSecretUI()
	u.LoginWithSecretUI(secui, tc.G)
	if !secui.CalledGetPassphrase {
		t.Errorf("get keybase passphrase not called")
	}

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	uis := libkb.UIs{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change after pubkey login")
}

// Test changing the passphrase when previous pp stream available.
func TestPassphraseChangeKnownNotSupplied(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := &libkb.TestSecretUI{}
	uis := libkb.UIs{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if secui.CalledGetPassphrase {
		t.Errorf("get kb passphrase called")
	}

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change known, not supplied")
}

// Test changing the passphrase when user forgets current
// passphrase.
func TestPassphraseChangeUnknown(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// this has a flaw:  the passphrase stream cache is available.
	// it is being used to unlock the secret key to generate the
	// change passphrase proof.
	//

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change unknown")
}

// Test changing the passphrase when user forgets current
// passphrase and there's no passphrase stream cache.
// No backup key available.
func TestPassphraseChangeUnknownNoPSCache(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	u, _, _ := CreateAndSignupFakeUserCustomArg(tc, "paper", f)

	tc.SimulateServiceRestart()

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err == nil {
		t.Fatal("passphrase change should have failed")
	}
	if _, ok := err.(libkb.NoPaperKeysError); !ok {
		t.Fatalf("unexpected error: %s (%T)", err, err)
	}

	assertLoadSecretKeys(tc, u, "passphrase change unknown, no ps cache")
}

// Test changing the passphrase when user forgets current
// passphrase and there's no passphrase stream cache.
// Backup key exists
func TestPassphraseChangeUnknownBackupKey(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	m = m.WithSecretUI(&libkb.TestSecretUI{Passphrase: backupPassphrase})

	m.ActiveDevice().ClearCaches()

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change unknown, backup key")
}

// Test changing the passphrase when user forgets current
// passphrase and is logged out, but has a backup key.
func TestPassphraseChangeLoggedOutBackupKey(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	assertLoadSecretKeys(tc, u, "logged out w/ backup key, before passphrase change")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	m = m.WithSecretUI(&libkb.TestSecretUI{Passphrase: backupPassphrase})

	Logout(tc)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, after passphrase change")
}

// Test changing the passphrase when user forgets current passphrase
// and is logged out, but has a backup key (generated by a secret from
// the secret store).
func TestPassphraseChangeLoggedOutBackupKeySecretStore(t *testing.T) {

	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := NewFakeUserOrBust(tc.T, "login")
	signupArg := MakeTestSignupEngineRunArg(u)
	signupArg.StoreSecret = true
	_ = SignupFakeUserWithArg(tc, u, signupArg)

	// This needs to happen *before* resetting the login state, as
	// this call will cause the login state to be reloaded.
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, before passphrase change")

	tc.SimulateServiceRestart()

	secretUI := libkb.TestSecretUI{}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &secretUI,
	}
	beng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}

	if secretUI.CalledGetPassphrase {
		t.Fatal("GetPassphrase() unexpectedly called")
	}

	backupPassphrase := beng.Passphrase()
	m = m.WithSecretUI(&libkb.TestSecretUI{Passphrase: backupPassphrase})

	Logout(tc)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, after passphrase change")
}

// Test using an lksec-encrypted pgp private key after changing the
// passphrase.
func TestPassphraseChangePGPUsage(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	clearCaches(tc.G)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := u.NewSecretUI()
	uis := libkb.UIs{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if !secui.CalledGetPassphrase {
		t.Errorf("get kb passphrase not called")
	}

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change pgp")
	assertLoadPGPKeys(tc, u)
}

// Test using a 3sec-encrypted pgp private key after changing the
// passphrase.
func TestPassphraseChangePGP3Sec(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkeyPushed(tc)

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	clearCaches(tc.G)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := u.NewSecretUI()
	uis := libkb.UIs{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if !secui.CalledGetPassphrase {
		t.Errorf("get kb passphrase not called")
	}

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change pgp")
	assertLoadPGPKeys(tc, u)
}

// Test changing the passphrase when user forgets current
// passphrase and is logged out, but has a backup key.
// Also, this user has a 3sec-encrypted private pgp key
// that will be unusable after changing passphrase.
func TestPassphraseChangeLoggedOutBackupKeyPlusPGP(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkeyPushed(tc)

	assertLoadSecretKeys(tc, u, "logged out w/ backup key, before passphrase change")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	m = m.WithSecretUI(&libkb.TestSecretUI{Passphrase: backupPassphrase})
	Logout(tc)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, after passphrase change")
}

// Test changing the passphrase when user forgets current passphrase
// and is logged out, but has a backup key (generated by a secret from
// the secret store).  And test using an lksec pgp key after the change.
func TestPassphraseChangeLoggedOutBackupKeySecretStorePGP(t *testing.T) {

	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := NewFakeUserOrBust(tc.T, "login")
	signupArg := MakeTestSignupEngineRunArg(u)
	signupArg.StoreSecret = true
	_ = SignupFakeUserWithArg(tc, u, signupArg)

	// add a pgp sibkey, pushed to server and stored locally (lksec)
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		PushSecret: true,
	}
	arg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != nil {
		tc.T.Fatal(err)
	}

	// This needs to happen *before* resetting the login state, as
	// this call will cause the login state to be reloaded.
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, before passphrase change")

	tc.SimulateServiceRestart()

	secretUI := libkb.TestSecretUI{}
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &secretUI,
	}
	beng := NewPaperKey(tc.G)
	m = NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}

	if secretUI.CalledGetPassphrase {
		t.Fatal("GetPassphrase() unexpectedly called")
	}

	backupPassphrase := beng.Passphrase()
	m = m.WithSecretUI(&libkb.TestSecretUI{Passphrase: backupPassphrase})

	Logout(tc)

	newPassphrase := "password1234"
	pcarg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	pceng := NewPassphraseChange(tc.G, pcarg)
	if err := RunEngine2(m, pceng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, after passphrase change")
	assertLoadPGPKeys(tc, u)
}

// test pp change when user has multiple 3sec encrypted pgp keys.
func TestPassphraseChangePGP3SecMultiple(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkeyPushed(tc)

	// create/push another pgp key
	parg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
		PushSecret: true,
		NoSave:     true,
		AllowMulti: true,
	}
	parg.Gen.MakeAllIds(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	peng := NewPGPKeyImportEngine(tc.G, parg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, peng)
	if err != nil {
		t.Fatal(err)
	}

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	clearCaches(tc.G)

	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := u.NewSecretUI()
	uis = libkb.UIs{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(tc.G, arg)
	m = NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if !secui.CalledGetPassphrase {
		t.Errorf("get kb passphrase not called")
	}

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change pgp")
	assertLoadPGPKeys(tc, u)

	me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	syncKeys, err := me.AllSyncedSecretKeys(m)
	if err != nil {
		t.Fatal(err)
	}
	if len(syncKeys) != 2 {
		t.Errorf("num pgp sync keys: %d, expected 2", len(syncKeys))
	}
	for _, key := range syncKeys {
		parg := libkb.SecretKeyPromptArg{
			SecretUI: u.NewSecretUI(),
		}
		unlocked, err := key.PromptAndUnlock(m, parg, nil, me)
		if err != nil {
			t.Fatal(err)
		}
		if unlocked == nil {
			t.Fatal("failed to unlock key")
		}
	}
}

// Make sure passphrase generations are stored properly alongside encrypted keys.
// We'll create a user, check the ppgens of the initial pair of keys, change the
// passphrase, create a new key, and then they the ppgen of that new one (which
// should be higher).
func TestPassphraseGenerationStored(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// All of the keys initially created with the user should be stored as
	// passphrase generation 1.
	skbKeyringFile, err := libkb.LoadSKBKeyring(u.NormalizedUsername(), tc.G)
	if err != nil {
		t.Fatal(err)
	}
	initialGenerationOneCount := 0
	for _, block := range skbKeyringFile.Blocks {
		if block.Priv.PassphraseGeneration != 1 {
			t.Fatalf("Expected all encrypted keys to be ppgen 1. Found %d.",
				block.Priv.PassphraseGeneration)
		}
		initialGenerationOneCount++
	}

	//
	// Do a passphrase change.
	//
	newPassphrase := "password1234"
	arg := &keybase1.PassphraseChangeArg{
		OldPassphrase: u.Passphrase,
		Passphrase:    newPassphrase,
	}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	u.Passphrase = newPassphrase

	//
	// Now, generate a new key. This one should be stored with ppgen 2.
	//
	pgpArg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	pgpArg.Gen.MakeAllIds(tc.G)
	pgpEng := NewPGPKeyImportEngine(tc.G, pgpArg)
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	m = NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, pgpEng)
	if err != nil {
		t.Fatal(err)
	}

	//
	// Finally, check that the new key (and only the new key) is marked as ppgen 2.
	//
	finalSKBKeyringFile, err := libkb.LoadSKBKeyring(u.NormalizedUsername(), tc.G)
	if err != nil {
		t.Fatal(err)
	}
	finalGenOneCount := 0
	finalGenTwoCount := 0
	for _, block := range finalSKBKeyringFile.Blocks {
		if block.Priv.PassphraseGeneration == 1 {
			finalGenOneCount++
		} else if block.Priv.PassphraseGeneration == 2 {
			finalGenTwoCount++
		} else {
			t.Fatalf("Expected all encrypted keys to be ppgen 1 or 2. Found %d.",
				block.Priv.PassphraseGeneration)
		}
	}
	if finalGenOneCount != initialGenerationOneCount {
		t.Fatalf("Expected initial count of ppgen 1 keys (%d) to equal final count (%d).",
			initialGenerationOneCount, finalGenOneCount)
	}
	if finalGenTwoCount != 1 {
		t.Fatalf("Expected one key in ppgen 2. Found %d keys.", finalGenTwoCount)
	}
}
