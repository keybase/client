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
		SecretUI: libkb.TestSecretUI{},
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
	newPassphrase := "password"
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: newPassphrase,
	}
	ctx := &Context{
		SecretUI: u.NewSecretUI(),
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
		SecretUI: libkb.TestSecretUI{},
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
