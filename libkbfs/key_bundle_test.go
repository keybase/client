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

func testKeyBundleCheckKeys(t *testing.T, config Config, uid keybase1.UID,
	dkb DirKeyBundle, ePubKey TLFEphemeralPublicKey,
	tlfCryptKey TLFCryptKey, serverMap serverKeyMap) {
	ctx := context.Background()
	// Check that every user can recover the crypt key
	cryptPublicKey, err := config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatalf("Couldn't get current public key for user %s: %v", uid, err)
	}
	info, ok, err := dkb.GetTLFCryptKeyInfo(uid, cryptPublicKey)
	if !ok || err != nil {
		t.Fatalf("Couldn't get current key info for user %s: %v", uid, err)
	}
	userEPubKey, err := dkb.GetTLFEphemeralPublicKey(uid, cryptPublicKey)
	if err != nil {
		t.Fatalf("Error getting ephemeral public key for user %s: %v", uid, err)
	}
	if g, e := userEPubKey, ePubKey; g != e {
		t.Fatalf("Unexpected ePubKey for user %s: %s vs %s", uid, g, e)
	}
	clientHalf, err := config.Crypto().DecryptTLFCryptKeyClientHalf(
		ctx, userEPubKey, info.ClientHalf)
	if err != nil {
		t.Fatalf("Couldn't decrypt client key half for user %s: %v", uid, err)
	}
	serverHalf, ok := serverMap[uid][cryptPublicKey.KID]
	if !ok {
		t.Fatalf("No server half for user %s", uid)
	}
	userTLFCryptKey, err :=
		config.Crypto().UnmaskTLFCryptKey(serverHalf, clientHalf)
	if err != nil {
		t.Fatalf("Couldn't unmask TLF key for user %s: %v", uid, err)
	}
	if g, e := userTLFCryptKey, tlfCryptKey; g != e {
		t.Fatalf("TLF crypt key didn't match for user %s: %s vs. %s", uid, g, e)
	}
}

func TestKeyBundleFillInDevices(t *testing.T) {
	config1 := MakeTestConfigOrBust(t, "u1", "u2", "u3")
	defer config1.Shutdown()
	config2 := ConfigAsUser(config1, "u2")
	defer config2.Shutdown()
	config3 := ConfigAsUser(config1, "u3")
	defer config3.Shutdown()

	ctx := context.Background()
	u1, err := config1.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatalf("Couldn't get uid for user 1: %v", err)
	}
	u2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatalf("Couldn't get uid for user 2: %v", err)
	}
	u3, err := config3.KBPKI().GetCurrentUID(ctx)
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
	serverMap, err := dkb.fillInDevices(config1.Crypto(), wKeys, rKeys,
		ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1, u1, dkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config2, u2, dkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config3, u3, dkb, ePubKey, tlfCryptKey, serverMap)

	// Add a device key for user 1
	devIndex := AddDeviceForLocalUserOrBust(t, config1, u1)
	config1B := ConfigAsUser(config1, "u1")
	defer config1B.Shutdown()
	SwitchDeviceForLocalUserOrBust(t, config1B, devIndex)
	newCryptPublicKey, err := config1B.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatalf("COuldn't get new publc device key for user %s: %v", u1, err)
	}
	wKeys[u1] = append(wKeys[u1], newCryptPublicKey)

	// Fill in the bundle again, make sure only the new device key
	// gets a ePubKeyIndex bump
	_, _, ePubKey2, ePrivKey2, _, err := config1.Crypto().MakeRandomTLFKeys()
	if err != nil {
		t.Fatalf("Couldn't make keys: %v", err)
	}
	serverMap2, err := dkb.fillInDevices(config1.Crypto(), wKeys, rKeys,
		ePubKey2, ePrivKey2, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1B, u1, dkb, ePubKey2, tlfCryptKey,
		serverMap2)
	if len(serverMap2) > 1 {
		t.Fatalf("Generated more than one key after device add: %d",
			len(serverMap2))
	}
}
