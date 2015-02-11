package engine

import (
	"github.com/keybase/go/libkb"
	"testing"
)

func TestDeviceKey(t *testing.T) {
	tc := libkb.SetupTest(t, "dkal")
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

		if kid, err := u.GetDeviceKID(); err != nil {
			t.Fatal(err)
		} else if kid == nil {
			t.Fatalf("Failed to load device key right after signup")
		}
	}
	check()

	G.LoginState.Logout()
	fu.LoginOrBust(t)
	check()
}
