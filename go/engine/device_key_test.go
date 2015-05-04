package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestDeviceKey(t *testing.T) {
	tc := SetupEngineTest(t, "dkal")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "dkal")

	check := func() {
		u, err := libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			t.Fatal(err)
		}
		if u == nil {
			t.Fatalf("Can't load current user")
		}

		if subkeyKid, err := u.GetDeviceSubkeyKid(G); err != nil {
			t.Fatal(err)
		} else if subkeyKid == nil {
			t.Fatalf("Failed to load device key right after signup")
		}
	}
	check()

	G.Logout()
	fu.LoginOrBust(t)
	check()
}
