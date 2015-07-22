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
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		_, _, err := proveRooterWithSecretUI(tc.G, fu, secretUI)
		if err != nil {
			t.Fatal(err)
		}
	})
}
