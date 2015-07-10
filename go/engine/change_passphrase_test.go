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
	arg := &keybase1.ChangePassphraseArg{
		OldPassphrase: u.Passphrase,
		NewPassphrase: "password",
	}
	ctx := &Context{
		SecretUI: u.NewSecretUI(),
	}
	eng := NewChangePassphrase(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

// Test changing the passphrase when user knows current
// passphrase, prompt for it.
func TestChangePassphraseKnownPrompt(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	arg := &keybase1.ChangePassphraseArg{
		NewPassphrase: "password",
	}
	ctx := &Context{
		SecretUI: u.NewSecretUI(),
	}
	eng := NewChangePassphrase(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

// Test changing the passphrase when user forgets current
// passphrase.
func TestChangePassphraseUnknown(t *testing.T) {
	tc := SetupEngineTest(t, "ChangePassphrase")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	_ = u // will need this when test gets flushed out...
	Logout(tc)

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
}
