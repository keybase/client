package engine

import (
	"os"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
)

func TestBootstrap(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)

	// do a upak load to make sure it is cached
	arg := libkb.NewLoadUserByUIDArg(context.TODO(), tc.G, u1.UID())
	tc.G.GetUPAKLoader().Load(arg)

	// get the status values
	uid := tc.G.Env.GetUID()
	username := tc.G.Env.GetUsername()
	deviceID := tc.G.Env.GetDeviceID()

	// Simulate restarting the service by wiping out the
	// passphrase stream cache and cached secret keys
	clearCaches(tc.G)
	tc.G.GetUPAKLoader().ClearMemory()

	// set server uri to nonexistent ip so api calls will fail
	prev := os.Getenv("KEYBASE_SERVER_URI")
	os.Setenv("KEYBASE_SERVER_URI", "http://127.0.0.127:3333")
	defer os.Setenv("KEYBASE_SERVER_URI", prev)
	tc.G.ConfigureAPI()
	tc.G.ConnectivityMonitor = OfflineConnectivityMonitor{}

	eng := NewLoginOffline(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	beng := NewBootstrap(tc.G)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}
	status := beng.Status()

	if !status.Registered {
		t.Error("registered false")
	}
	if !status.LoggedIn {
		t.Error("not logged in")
	}
	if status.Uid.IsNil() {
		t.Errorf("uid nil")
	}
	if !status.Uid.Equal(uid) {
		t.Errorf("uid: %s, expected %s", status.Uid, uid)
	}
	if status.Username == "" {
		t.Errorf("username empty")
	}
	if status.Username != username.String() {
		t.Errorf("username: %q, expected %q", status.Username, username)
	}
	if !status.DeviceID.Eq(deviceID) {
		t.Errorf("device id: %q, expected %q", status.DeviceID, deviceID)
	}
	if status.DeviceName != defaultDeviceName {
		t.Errorf("device name: %q, expected %q", status.DeviceName, defaultDeviceName)
	}
}

func TestBootstrapAfterSignup(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")

	beng := NewBootstrap(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, beng); err != nil {
		t.Fatal(err)
	}
	status := beng.Status()

	uid := tc.G.Env.GetUID()
	deviceID := tc.G.Env.GetDeviceID()

	if !status.Registered {
		t.Error("registered false")
	}
	if !status.LoggedIn {
		t.Error("not logged in")
	}
	if status.Uid.IsNil() {
		t.Errorf("uid nil")
	}
	if !status.Uid.Equal(uid) {
		t.Errorf("uid: %s, expected %s", status.Uid, uid)
	}
	if status.Username == "" {
		t.Errorf("username empty")
	}
	if status.Username != u1.Username {
		t.Errorf("username: %q, expected %q", status.Username, u1.Username)
	}
	if !status.DeviceID.Eq(deviceID) {
		t.Errorf("device id: %q, expected %q", status.DeviceID, deviceID)
	}
	if status.DeviceName != defaultDeviceName {
		t.Errorf("device name: %q, expected %q", status.DeviceName, defaultDeviceName)
	}
}

type OfflineConnectivityMonitor struct {
}

func (s OfflineConnectivityMonitor) IsConnected(ctx context.Context) libkb.ConnectivityMonitorResult {
	return libkb.ConnectivityMonitorNo
}

func (s OfflineConnectivityMonitor) CheckReachability(ctx context.Context) error {
	return nil
}

var _ libkb.ConnectivityMonitor = OfflineConnectivityMonitor{}
