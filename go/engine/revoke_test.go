package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func getActiveDevicesAndKeys(t *testing.T, u *FakeUser) ([]*libkb.Device, []libkb.GenericKey) {
	user, err := libkb.LoadUser(libkb.LoadUserArg{Name: u.Username, PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	sibkeys := user.GetComputedKeyFamily().GetAllActiveSibkeys()
	subkeys := user.GetComputedKeyFamily().GetAllActiveSubkeys()

	activeDevices := []*libkb.Device{}
	for _, device := range user.GetComputedKeyFamily().GetAllDevices() {
		if device.Status != nil && *device.Status == libkb.DeviceStatusActive {
			activeDevices = append(activeDevices, device)
		}
	}
	return activeDevices, append(sibkeys, subkeys...)
}

func doRevokeKey(tc libkb.TestContext, u *FakeUser, id string) error {
	revokeEngine := NewRevokeKeyEngine(id, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := RunEngine(revokeEngine, ctx)
	return err
}

func doRevokeDevice(tc libkb.TestContext, u *FakeUser, id keybase1.DeviceID, force bool) error {
	revokeEngine := NewRevokeDeviceEngine(RevokeDeviceEngineArgs{ID: id, Force: force}, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := RunEngine(revokeEngine, ctx)
	return err
}

func assertNumDevicesAndKeys(t *testing.T, u *FakeUser, numDevices, numKeys int) {
	devices, keys := getActiveDevicesAndKeys(t, u)
	if len(devices) != numDevices {
		for i, d := range devices {
			t.Logf("device %d: %+v", i, d)
		}
		t.Fatalf("Expected to find %d devices. Found %d.", numDevices, len(devices))
	}
	if len(keys) != numKeys {
		for i, k := range keys {
			t.Logf("key %d: %+v", i, k)
		}
		t.Fatalf("Expected to find %d keys. Found %d.", numKeys, len(keys))
	}
}

func TestRevokeDevice(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "rev")

	assertNumDevicesAndKeys(t, u, 3, 6)

	devices, _ := getActiveDevicesAndKeys(t, u)
	var webDevice *libkb.Device
	var thisDevice *libkb.Device
	for _, device := range devices {
		if device.Type == "web" {
			webDevice = device
		} else if device.Type != "backup" {
			thisDevice = device
		}
	}
	if webDevice == nil {
		t.Fatal("Expected to find a web device.")
	}

	// Revoking the web device should succeed.
	err := doRevokeDevice(tc, u, webDevice.ID, false)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(t, u, 2, 4)

	// Revoking the current device should fail.
	err = doRevokeDevice(tc, u, thisDevice.ID, false)
	if err == nil {
		tc.T.Fatal("Expected revoking the current device to fail.")
	}

	assertNumDevicesAndKeys(t, u, 2, 4)

	// But it should succeed with the --force flag.
	err = doRevokeDevice(tc, u, thisDevice.ID, true)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(t, u, 1, 2)
}

func TestRevokeKey(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)

	assertNumDevicesAndKeys(t, u, 3, 7)

	_, keys := getActiveDevicesAndKeys(t, u)
	var pgpKey *libkb.GenericKey
	for i, key := range keys {
		if libkb.IsPGP(key) {
			// XXX: Don't use &key. That refers to the loop variable, which
			// gets overwritten.
			pgpKey = &keys[i] //
			break
		}
	}
	if pgpKey == nil {
		t.Fatal("Expected to find PGP key")
	}

	err := doRevokeKey(tc, u, (*pgpKey).GetKID().String())
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(t, u, 3, 6)
}

// See issue #370.
func TestTrackAfterRevoke(t *testing.T) {
	tc1 := SetupEngineTest(t, "rev")
	defer tc1.Cleanup()

	// We need two devices.  Going to use GPG to sign second device.

	// Sign up on tc1:
	u := CreateAndSignupFakeUserGPG(tc1, "pgp")

	// Redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// We need the gpg keyring that's in the first device homedir:
	if err := tc1.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// Login on device tc2.  It will use gpg to sign the device.
	docui := &lockuiPGP{&lockui{deviceName: "Device2"}}
	li := NewLoginWithPromptEngine(u.Username, tc2.G)
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    u.NewSecretUI(),
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	// tc2 revokes tc1 device:
	err := doRevokeDevice(tc2, u, tc1.G.Env.GetDeviceID(), false)
	if err != nil {
		tc2.T.Fatal(err)
	}

	// Still logged in on tc1.  Try to use it to track someone.  It should fail
	// with a KeyRevokedError.
	_, _, err = runTrack(tc1, u, "t_alice")
	if err == nil {
		t.Fatal("expected runTrack to return an error")
	}
	if _, ok := err.(libkb.KeyRevokedError); !ok {
		t.Errorf("expected libkb.KeyRevokedError, got %T", err)
	}
}
