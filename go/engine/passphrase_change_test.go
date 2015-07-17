package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}

	if !secui.CalledGetKBPassphrase {
		t.Errorf("get kb passphrase not called")
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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}

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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}

	if secui.CalledGetKBPassphrase {
		t.Errorf("get kb passphrase called")
	}
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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}
}

// Test changing the passphrase when user forgets current
// passphrase and there's no passphrase stream cache.
// No backup key available.
func TestPassphraseChangeUnknownNoPSCache(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")

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
	if _, ok := err.(libkb.NoSecretKeyError); !ok {
		t.Fatalf("unexpected error: %s (%T)", err, err)
	}
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
	beng := NewBackupKeygen(tc.G)
	if err := RunEngine(beng, ctx); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	_ = backupPassphrase // this will be needed later...

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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}
}

// Test changing the passphrase when user forgets current
// passphrase and is logged out, but has a backup key.
func TestPassphraseChangeLoggedOutBackupKey(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	beng := NewBackupKeygen(tc.G)
	if err := RunEngine(beng, ctx); err != nil {
		t.Fatal(err)
	}
	backupPassphrase := beng.Passphrase()
	_ = backupPassphrase // this will be needed later...

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

	_, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(u.Passphrase)
	if err == nil {
		t.Fatal("old passphrase passed verification")
	}
}
