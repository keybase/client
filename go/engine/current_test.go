package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestCurrentUID(t *testing.T) {
	tc := SetupEngineTest(t, "current")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "login")

	currentUID, err := CurrentUID(tc.G)
	if err != nil {
		t.Fatal(err)
	}

	loadedUser, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}

	if currentUID != loadedUser.GetUID() {
		t.Errorf("current uid: %s, loaded uid: %s\n", currentUID, loadedUser.GetUID())
	}

	Logout(tc)

	currentUID, err = CurrentUID(tc.G)
	if err == nil {
		t.Fatal("expected error in CurrentUID when logged out")
	}
	if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Fatalf("expected LoginRequiredError, got %T", err)
	}
}
