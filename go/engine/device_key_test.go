package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestDeviceKey(t *testing.T) {
	tc := SetupEngineTest(t, "dkal")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "dkal")

	check := func() {
		u, err := libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			t.Fatal(err)
		}
		if u == nil {
			t.Fatalf("Can't load current user")
		}

		if sibkey, subkey, err := u.GetDeviceKeys(); err != nil {
			t.Fatal(err)
		} else if sibkey == nil || subkey == nil {
			t.Fatalf("Failed to load device keys right after signup")
		}
	}
	check()

	tc.G.Logout()
	fu.LoginOrBust(tc)
	check()
}
