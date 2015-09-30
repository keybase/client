package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestLoadUserPlusKeysHasKeys(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	up, err := libkb.LoadUserPlusKeys(tc.G, u.Username, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(up.DeviceKeys) != 2 {
		t.Errorf("num device keys: %d, expected 2", len(up.DeviceKeys))
	}
}
