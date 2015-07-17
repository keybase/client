package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestProveRooter(t *testing.T) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")

	proveUI, _, err := proveRooter(tc.G, fu)
	if err != nil {
		t.Fatal(err)
	}

	if proveUI.overwrite {
		t.Error("unexpected prompt for overwrite in test")
	}
	if proveUI.warning {
		t.Error("got unexpected warning in test")
	}
	if proveUI.recheck {
		t.Error("unexpected recheck")
	}
	if !proveUI.checked {
		t.Error("OkToCheck never called")
	}
}

// Make sure the prove engine uses the secret store.
func TestProveRooterWithSecretStore(t *testing.T) {
	// TODO: Get this working on non-OS X platforms (by mocking
	// out the SecretStore).
	if !libkb.HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "pwss")
	tc.G.ResetLoginStateForTest()

	testSecretUI := libkb.TestSecretUI{
		Passphrase:  fu.Passphrase,
		StoreSecret: true,
	}
	_, _, err := proveRooterWithSecretUI(tc.G, fu, &testSecretUI)
	if err != nil {
		t.Fatal(err)
	}

	if !testSecretUI.CalledGetSecret {
		t.Fatal("GetSecret() unexpectedly not called")
	}

	tc.G.ResetLoginStateForTest()

	testSecretUI = libkb.TestSecretUI{}
	_, _, err = proveRooterWithSecretUI(tc.G, fu, &testSecretUI)
	if err != nil {
		t.Fatal(err)
	}

	if testSecretUI.CalledGetSecret {
		t.Fatal("GetSecret() unexpectedly called")
	}
}
