package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
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
		if device.Status != nil && *device.Status == libkb.DEVICE_STATUS_ACTIVE {
			activeDevices = append(activeDevices, device)
		}
	}
	return activeDevices, append(sibkeys, subkeys...)
}

func doRevoke(tc libkb.TestContext, u *FakeUser, id string, mode RevokeMode) {
	revokeEngine := NewRevokeEngine(id, mode, tc.G)
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
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

	doRevoke(tc, u, webDevice.ID, RevokeDevice)

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

	doRevoke(tc, u, (*pgpKey).GetKid().String(), RevokeKey)

	assertNumDevicesAndKeys(t, u, 2, 4)
}
