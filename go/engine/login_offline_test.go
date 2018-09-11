package engine

import (
	"os"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
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
	clearCaches(tc.G)
	tc.G.GetUPAKLoader().ClearMemory()

	// set server uri to nonexistent ip so api calls will fail
	prev := os.Getenv("KEYBASE_SERVER_URI")
	os.Setenv("KEYBASE_SERVER_URI", "http://127.0.0.127:3333")
	defer os.Setenv("KEYBASE_SERVER_URI", prev)
	tc.G.ConfigureAPI()

	eng := NewLoginOffline(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	uv, deviceID, deviceName, skey, ekey := tc.G.ActiveDevice.AllFields()
	if uv.IsNil() {
		t.Errorf("uid is nil, expected it to exist")
	}
	if !uv.Uid.Equal(u1.UID()) {
		t.Errorf("uid: %v, expected %v", uv, u1)
	}

	if deviceID.IsNil() {
		t.Errorf("deviceID is nil, expected it to exist")
	}

	if deviceName != defaultDeviceName {
		t.Errorf("device name: %q, expected %q", deviceName, defaultDeviceName)
	}

	if skey == nil {
		t.Errorf("signing key is nil, expected it to exist")
	}

	if ekey == nil {
		t.Errorf("encryption key is nil, expected it to exist")
	}

	if tc.G.ActiveDevice.Name() != defaultDeviceName {
		t.Errorf("device name: %q, expected %q", tc.G.ActiveDevice.Name(), defaultDeviceName)
	}
}

// Use fake clock to test login offline after significant delay
// (make sure upak loader won't use network)
func TestLoginOfflineDelay(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)

	// do a upak load to make sure it is cached
	arg := libkb.NewLoadUserByUIDArg(context.TODO(), tc.G, u1.UID())
	tc.G.GetUPAKLoader().Load(arg)

	// Simulate restarting the service by wiping out the
	// passphrase stream cache and cached secret keys
	clearCaches(tc.G)
	tc.G.GetUPAKLoader().ClearMemory()

	// set server uri to nonexistent ip so api calls will fail
	prev := os.Getenv("KEYBASE_SERVER_URI")
	os.Setenv("KEYBASE_SERVER_URI", "http://127.0.0.127:3333")
	defer os.Setenv("KEYBASE_SERVER_URI", prev)
	tc.G.ConfigureAPI()

	// advance the clock past the cache timeout
	fakeClock.Advance(libkb.CachedUserTimeout * 10)

	eng := NewLoginOffline(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	uv, deviceID, deviceName, skey, ekey := tc.G.ActiveDevice.AllFields()
	if uv.IsNil() {
		t.Errorf("uid is nil, expected it to exist")
	}
	if !uv.Uid.Equal(u1.UID()) {
		t.Errorf("uid: %v, expected %v", uv, u1.UID())
	}

	if deviceID.IsNil() {
		t.Errorf("deviceID is nil, expected it to exist")
	}

	if deviceName != defaultDeviceName {
		t.Errorf("device name: %q, expected %q", deviceName, defaultDeviceName)
	}

	if skey == nil {
		t.Errorf("signing key is nil, expected it to exist")
	}

	if ekey == nil {
		t.Errorf("encryption key is nil, expected it to exist")
	}
}

// Login offline with nothing in upak cache for self user.
func TestLoginOfflineNoUpak(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)

	// Simulate restarting the service by wiping out the
	// passphrase stream cache and cached secret keys
	tc.SimulateServiceRestart()
	tc.G.GetUPAKLoader().ClearMemory()

	// invalidate the cache for uid
	tc.G.GetUPAKLoader().Invalidate(context.Background(), u1.UID())

	// set server uri to nonexistent ip so api calls will fail
	prev := os.Getenv("KEYBASE_SERVER_URI")
	os.Setenv("KEYBASE_SERVER_URI", "http://127.0.0.127:3333")
	defer os.Setenv("KEYBASE_SERVER_URI", prev)
	tc.G.ConfigureAPI()

	eng := NewLoginOffline(tc.G)
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	if err == nil {
		t.Fatal("LoginOffline worked after upak cache invalidation")
	}
	if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Fatalf("LoginOffline error: %s (%T) expected libkb.LoginRequiredError", err, err)
	}
}
