package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func verifyPassphraseChange(tc libkb.TestContext, u *FakeUser, newPassphrase string) {
	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		tc.T.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		tc.T.Fatal("old passphrase passed verification")
	}
}

func assertLoadSecretKeys(tc libkb.TestContext, u *FakeUser, msg string) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	skarg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, _, err := tc.G.Keyrings.GetSecretKeyWithPrompt(nil, skarg, u.NewSecretUI(), "testing sig")
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	if sigKey == nil {
		tc.T.Fatalf("%s: got nil signing key", msg)
	}

	skarg.KeyType = libkb.DeviceEncryptionKeyType
	encKey, _, err := tc.G.Keyrings.GetSecretKeyWithPrompt(nil, skarg, u.NewSecretUI(), "testing enc")
	if err != nil {
		tc.T.Fatalf("%s: %s", msg, err)
	}
	if encKey == nil {
		tc.T.Fatalf("%s: got nil encryption key", msg)
	}
}

// Test changing the passphrase when user knows current
// passphrase.
func TestPassphraseChangeKnown(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		OldPassphrase: u.Passphrase,
		Passphrase:    newPassphrase,
	}

	// using an empty secret ui to make sure existing pp doesn't come from ui prompt:
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change known")
}

// Test changing the passphrase when user knows current
// passphrase, prompt for it.
func TestPassphraseChangeKnownPrompt(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := u.NewSecretUI()
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if !secui.CalledGetKBPassphrase {
		t.Errorf("get kb passphrase not called")
	}

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "passphrase change known prompt")
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
	if !secui.CalledGetSecret {
		t.Errorf("get secret not called")
	}

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
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
	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
	}
	secui := &libkb.TestSecretUI{}
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	if secui.CalledGetKBPassphrase {
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

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
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

	u := CreateAndSignupFakeUser(tc, "login")

	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("passphrase change should have failed")
	}
	if _, ok := err.(libkb.NoBackupKeysError); !ok {
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

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewBackup(tc.G)
	if err := RunEngine(beng, ctx); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	ctx.SecretUI = &libkb.TestSecretUI{BackupPassphrase: backupPassphrase}

	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
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

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewBackup(tc.G)
	if err := RunEngine(beng, ctx); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	ctx.SecretUI = &libkb.TestSecretUI{BackupPassphrase: backupPassphrase}

	Logout(tc)

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
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
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := NewFakeUserOrBust(tc.T, "login")
	signupArg := MakeTestSignupEngineRunArg(u)
	signupArg.StoreSecret = true
	_ = SignupFakeUserWithArg(tc, u, signupArg)

	// This needs to happen *before* resetting the login state, as
	// this call will cause the login state to be reloaded.
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, before passphrase change")

	tc.ResetLoginState()

	secretUI := libkb.TestSecretUI{}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{},
		SecretUI: &secretUI,
	}
	beng := NewBackup(tc.G)
	if err := RunEngine(beng, ctx); err != nil {
		t.Fatal(err)
	}

	if secretUI.CalledGetSecret {
		t.Fatal("GetSecret() unexpectedly called")
	}

	backupPassphrase := beng.Passphrase()
	ctx.SecretUI = &libkb.TestSecretUI{BackupPassphrase: backupPassphrase}

	Logout(tc)

	newPassphrase := "password"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	eng := NewPassphraseChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	verifyPassphraseChange(tc, u, newPassphrase)

	u.Passphrase = newPassphrase
	assertLoadSecretKeys(tc, u, "logged out w/ backup key, after passphrase change")
}
