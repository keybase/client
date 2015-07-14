package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func getActiveDevicesAndKeys(t *testing.T, u *FakeUser) ([]*libkb.Device, []libkb.GenericKey) {
	user, err := libkb.LoadUser(libkb.LoadUserArg{Name: u.Username})
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

func doRevokeKey(tc libkb.TestContext, u *FakeUser, id string) {
	revokeEngine := NewRevokeKeyEngine(id, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := RunEngine(revokeEngine, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func doRevokeDevice(tc libkb.TestContext, u *FakeUser, id keybase1.DeviceID) {
	revokeEngine := NewRevokeDeviceEngine(id, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := RunEngine(revokeEngine, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func assertNumDevicesAndKeys(t *testing.T, u *FakeUser, numDevices, numKeys int) {
	devices, keys := getActiveDevicesAndKeys(t, u)
	if len(devices) != numDevices {
		t.Fatalf("Expected to find %d devices. Found %d.", numDevices, len(devices))
	}
	if len(keys) != numKeys {
		t.Fatalf("Expected to find %d keys. Found %d.", numKeys, len(keys))
	}
}

func TestRevokeDevice(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "rev")

	assertNumDevicesAndKeys(t, u, 2, 4)

	devices, _ := getActiveDevicesAndKeys(t, u)
	var webDevice *libkb.Device
	for _, device := range devices {
		if device.Type == "web" {
			webDevice = device
			break
		}
	}
	if webDevice == nil {
		t.Fatal("Expected to find a web device.")
	}

	doRevokeDevice(tc, u, webDevice.ID)

	assertNumDevicesAndKeys(t, u, 1, 2)
}

func TestRevokeKey(t *testing.T) {
	tc := SetupEngineTest(t, "rev")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)

	assertNumDevicesAndKeys(t, u, 2, 5)

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

	doRevokeKey(tc, u, (*pgpKey).GetKid().String())

	assertNumDevicesAndKeys(t, u, 2, 4)
}
