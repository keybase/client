package engine

import (
	"os"
	"testing"
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

	_ = CreateAndSignupFakeUser(tc, "reset")

	dbPath := tc.G.Env.GetDbFilename()
	sessionPath := tc.G.Env.GetSessionFilename()

	assertFileExists(t, dbPath)
	assertFileExists(t, sessionPath)

	if !tc.G.LoginState().IsLoggedIn() {
		t.Fatal("Unexpectedly logged out")
	}

	e := NewResetEngine(tc.G)
	ctx := &Context{}
	if err := RunEngine(e, ctx); err != nil {
		t.Fatal(err)
	}

	if tc.G.LoginState().IsLoggedIn() {
		t.Error("Unexpectedly still logged in")
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, sessionPath)
}
