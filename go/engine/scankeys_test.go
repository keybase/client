package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestScanKeys(t *testing.T) {
	tc := SetupEngineTest(t, "ScanKeys")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	sk, err := NewScanKeys(u, fu.NewSecretUI())
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 0 {
		t.Errorf("scankey count: %d, expected 0", sk.Count())
	}
}

// TestScanKeysSync checks a user with a synced
func TestScanKeysSync(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	sk, err := NewScanKeys(u, fu.NewSecretUI())
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 1 {
		t.Errorf("scankey count: %d, expected 1", sk.Count())
	}
}
