package engine

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestBootstrap(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)

	// do a upak load to make sure it is cached
	arg := libkb.NewLoadUserByUIDArg(context.TODO(), tc.G, u1.UID())
	_, _, err := tc.G.GetUPAKLoader().Load(arg)
	require.NoError(t, err)

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
	err = tc.G.ConfigureAPI()
	require.NoError(t, err)
	tc.G.ConnectivityMonitor = OfflineConnectivityMonitor{}

	eng := NewLoginOffline(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	beng := NewBootstrap(tc.G)
	if err := RunEngine2(m, beng); err != nil {
		require.NoError(t, err)
	}
	status := beng.Status()

	require.True(t, status.Registered, "registered false")
	require.True(t, status.LoggedIn, "not logged in")
	require.False(t, status.Uid.IsNil(), "uid nil")
	require.True(t, status.Uid.Equal(uid), "uid: %s, expected %s", status.Uid, uid)
	require.False(t, status.Username == "", "username empty")
	require.Equal(t, username.String(), status.Username, "username: %q, expected %q", status.Username, username)
	require.True(t, status.DeviceID.Eq(deviceID), "device id: %q, expected %q", status.DeviceID, deviceID)
	require.Equal(t, defaultDeviceName, status.DeviceName, "device name: %q, expected %q", status.DeviceName, defaultDeviceName)
}

func TestBootstrapAfterSignup(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")

	beng := NewBootstrap(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, beng); err != nil {
		require.NoError(t, err)
	}
	status := beng.Status()

	uid := tc.G.Env.GetUID()
	deviceID := tc.G.Env.GetDeviceID()

	require.True(t, status.Registered, "registered false")
	require.True(t, status.LoggedIn, "not logged in")
	require.False(t, status.Uid.IsNil(), "uid nil")
	require.True(t, status.Uid.Equal(uid), "uid: %s, expected %s", status.Uid, uid)
	require.False(t, status.Username == "", "username empty")
	require.Equal(t, u1.Username, status.Username, "username: %q, expected %q", status.Username, u1.Username)
	require.True(t, status.DeviceID.Eq(deviceID), "device id: %q, expected %q", status.DeviceID, deviceID)
	require.Equal(t, defaultDeviceName, status.DeviceName, "device name: %q, expected %q", status.DeviceName, defaultDeviceName)
}

type OfflineConnectivityMonitor struct{}

func (s OfflineConnectivityMonitor) IsConnected(ctx context.Context) libkb.ConnectivityMonitorResult {
	return libkb.ConnectivityMonitorNo
}

func (s OfflineConnectivityMonitor) ConnectedSince(ctx context.Context) time.Time {
	return time.Time{}
}

func (s OfflineConnectivityMonitor) CheckReachability(ctx context.Context) error {
	return nil
}

var _ libkb.ConnectivityMonitor = OfflineConnectivityMonitor{}
