package libkbfs

import (
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

func testKeyBundleGetKeysOrBust(t *testing.T, config Config, uid keybase1.UID,
	keys map[keybase1.UID][]CryptPublicKey) {
	publicKeys, err := config.KBPKI().GetCryptPublicKeys(
		context.Background(), uid)
	if err != nil {
		t.Fatalf("Couldn't get keys for %s: %v", uid, err)
	}
	keys[uid] = publicKeys
}

func TestKeyBundleFillInDevices(t *testing.T) {
	config1 := MakeTestConfigOrBust(t, "u1", "u2", "u3")
	defer config1.Shutdown()
	config2 := ConfigAsUser(config1, "u2")
	defer config2.Shutdown()
	config3 := ConfigAsUser(config1, "u3")
	defer config3.Shutdown()

	u1, err := config1.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get uid for user 1: %v", err)
	}
	u2, err := config2.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get uid for user 2: %v", err)
	}
	u3, err := config3.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get uid for user 3: %v", err)
	}

	// Make a DKB with empty UserCryptKeyBundles
	dkb := DirKeyBundle{
		WKeys: make(map[keybase1.UID]UserCryptKeyBundle),
		RKeys: make(map[keybase1.UID]UserCryptKeyBundle),
		TLFEphemeralPublicKeys: make([]TLFEphemeralPublicKey, 1),
	}

	// Generate keys
	wKeys := make(map[keybase1.UID][]CryptPublicKey)
	rKeys := make(map[keybase1.UID][]CryptPublicKey)

	testKeyBundleGetKeysOrBust(t, config1, u1, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u2, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u3, wKeys)

	// Fill in the bundle
	_, _, ePubKey, ePrivKey, tlfCryptKey, err :=
		config1.Crypto().MakeRandomTLFKeys()
	if err != nil {
		t.Fatalf("Couldn't make keys: %v", err)
	}
	_, err = dkb.fillInDevices(config1.Crypto(), wKeys, rKeys,
		ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	// Add a device key

	// Fill in the bundle again, make sure only the new device key
	// gets a ePubKeyIndex bump
}
