package libkb

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
)

func TestLoggedInAfterSignup(t *testing.T) {
	tc := SetupTest(t, "account")
	defer tc.Cleanup()
	u, err := kbtest.CreateAndSignupFakeUser("login", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("user is nil")
	}
}
