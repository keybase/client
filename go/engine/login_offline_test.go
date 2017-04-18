package engine

import (
	"context"
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestLoginOffline(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)

	// do a upak load to make sure it is cached
	arg := libkb.NewLoadUserByUIDArg(context.TODO(), tc.G, u1.UID())
	tc.G.GetUPAKLoader().Load(arg)

	// Simulate restarting the service by wiping out the
	// passphrase stream cache and cached secret keys
	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
		a.ClearCachedSecretKeys()
	}, "account - clear")
	tc.G.GetUPAKLoader().ClearMemory()

	// set server uri to nonexistent ip so api calls will fail
	prev := os.Getenv("KEYBASE_SERVER_URI")
	os.Setenv("KEYBASE_SERVER_URI", "http://127.0.0.127:3333")
	defer os.Setenv("KEYBASE_SERVER_URI", prev)
	tc.G.ConfigureAPI()

	eng := NewLoginOffline(tc.G)
	ctx := &Context{}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	uid, deviceID, skey, ekey := tc.G.ActiveDevice.AllFields()
	if uid.IsNil() {
		t.Errorf("uid is nil, expected it to exist")
	}
	if !uid.Equal(u1.UID()) {
		t.Errorf("uid: %q, expected %q", uid, u1.UID())
	}

	if deviceID.IsNil() {
		t.Errorf("deviceID is nil, expected it to exist")
	}

	if skey == nil {
		t.Errorf("signing key is nil, expected it to exist")
	}

	if ekey == nil {
		t.Errorf("encryption key is nil, expected it to exist")
	}
}
