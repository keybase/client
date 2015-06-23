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

	fu := CreateAndSignupFakeUser(tc, "reset")

	// TODO: Pass a flag into CreateAndSignupFakeUser to have it
	// store the secret.
	secretStore := libkb.NewSecretStore(fu.Username)
	if secretStore != nil {
		err := secretStore.StoreSecret([]byte("fake secret"))
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
	ctx := &Context{}
	if err := RunEngine(e, ctx); err != nil {
		t.Fatal(err)
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly still logged in")
	}

	if secretStore != nil {
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			t.Error("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, sessionPath)
}
