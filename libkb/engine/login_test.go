package engine

import (
	"github.com/keybase/go/libkb"
	"testing"
)

func TestLogin(t *testing.T) {
	tc := libkb.SetupTest(t, "login", true)
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(t, "login")
	G.LoginState.Logout()
	u2 := CreateAndSignupFakeUser(t, "login")
	G.LoginState.Logout()
	u1.LoginOrBust(t)
	G.LoginState.Logout()
	u2.LoginOrBust(t)

	return
}
