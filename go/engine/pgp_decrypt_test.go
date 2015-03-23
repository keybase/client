package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// TestScanKeys tests libkb.ScanKey, but needs to be an engine
// test since it needs to have a logged in user to work.
func TestScanKeys(t *testing.T) {
	tc := SetupEngineTest(t, "ScanKeys")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(t, "login")
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	sk, err := libkb.NewScanKeys(u)
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 0 {
		t.Errorf("scankey count: %d, expected 0", sk.Count())
	}
}
