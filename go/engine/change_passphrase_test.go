package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Test changing the passphrase when user knows current
// passphrase.
func TestChangePassphraseKnown(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "password"
	arg := &keybase1.ChangePassphraseArg{
		OldPassphrase: u.Passphrase,
		NewPassphrase: newPassphrase,
	}

	// using an empty secret ui to make sure existing pp doesn't come from ui prompt:
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewChangePassphrase(arg, tc.G)
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
func TestChangePassphraseKnownPrompt(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	// clear the passphrase stream cache to force a prompt
	// for the existing passphrase.
	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	newPassphrase := "password"
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: newPassphrase,
	}
	secui := u.NewSecretUI()
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewChangePassphrase(arg, tc.G)
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
func TestChangePassphraseAfterPubkeyLogin(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
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
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: newPassphrase,
	}
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewChangePassphrase(arg, tc.G)
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
func TestChangePassphraseKnownNotSupplied(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	newPassphrase := "password"
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: newPassphrase,
	}
	secui := &libkb.TestSecretUI{}
	ctx := &Context{
		SecretUI: secui,
	}
	eng := NewChangePassphrase(arg, tc.G)
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
func TestChangePassphraseUnknown(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	newPassphrase := "password"
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: "password",
		Force:         true,
	}
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewChangePassphrase(arg, tc.G)
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
