package engine

import (
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func assertFileExists(t *testing.T, path string) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("%s unexpectedly does not exist", path)
	}
}

func assertFileDoesNotExist(t *testing.T, path string) {
	if _, err := os.Stat(path); err == nil {
		t.Fatalf("%s unexpectedly exists", path)
	}
}

func TestReset(t *testing.T) {
	tc := SetupEngineTest(t, "reset")
	defer tc.Cleanup()

	// Sign up a new user and have it store its secret in the
	// secret store.
	fu := NewFakeUserOrBust(tc.T, "reset")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = libkb.HasSecretStore()
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(fu.Username)
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			t.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	sessionPath := tc.G.Env.GetSessionFilename()

	assertFileExists(t, dbPath)
	assertFileExists(t, sessionPath)

	if !LoggedIn(tc) {
		t.Fatal("Unexpectedly logged out")
	}

	e := NewResetEngine(tc.G)
	ctx = &Context{}
	if err := RunEngine(e, ctx); err != nil {
		t.Fatal(err)
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly still logged in")
	}

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(fu.Username)
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			t.Error("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, sessionPath)
}
