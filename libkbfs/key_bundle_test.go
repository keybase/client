package libkbfs

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type tlfCryptKeyInfoUnknownFieldTest struct {
	t *testing.T
}

var _ structUnknownFieldsTest = tlfCryptKeyInfoUnknownFieldTest{}

func (tlfCryptKeyInfoUnknownFieldTest) makeEmptyStruct() interface{} {
	return TLFCryptKeyInfo{}
}

func (t tlfCryptKeyInfoUnknownFieldTest) makeFilledStruct() interface{} {
	hmac, err := DefaultHMAC([]byte("fake key"), []byte("fake buf"))
	require.Nil(t.t, err)
	return TLFCryptKeyInfo{
		ClientHalf: EncryptedTLFCryptKeyClientHalf{
			Version:       EncryptionSecretbox,
			EncryptedData: []byte("fake encrypted data"),
			Nonce:         []byte("fake nonce"),
		},
		ServerHalfID: TLFCryptKeyServerHalfID{
			ID: hmac,
		},
	}
}

func (tlfCryptKeyInfoUnknownFieldTest) filterKnownFields(i interface{}) interface{} {
	s := i.(TLFCryptKeyInfo)
	s.UnknownFieldSet = codec.UnknownFieldSet{}
	return s
}

type tlfCryptKeyInfoFuture struct {
	TLFCryptKeyInfo
	extra
}

func (tlfCryptKeyInfoUnknownFieldTest) makeEmptyFutureStruct() interface{} {
	return tlfCryptKeyInfoFuture{}
}

func (t tlfCryptKeyInfoUnknownFieldTest) makeFilledFutureStruct() interface{} {
	return tlfCryptKeyInfoFuture{
		TLFCryptKeyInfo: t.makeFilledStruct().(TLFCryptKeyInfo),
		extra:           makeExtraOrBust(t.t),
	}
}

func TestTLFCryptKeyInfoUnknownFields(t *testing.T) {
	testStructUnknownFields(t, tlfCryptKeyInfoUnknownFieldTest{t})
}

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
	tkb TLFKeyBundle, ePubKey TLFEphemeralPublicKey,
	tlfCryptKey TLFCryptKey, serverMap serverKeyMap) {
	ctx := context.Background()
	// Check that every user can recover the crypt key
	cryptPublicKey, err := config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatalf("Couldn't get current public key for user %s: %v", uid, err)
	}
	info, ok, err := tkb.GetTLFCryptKeyInfo(uid, cryptPublicKey)
	if !ok || err != nil {
		t.Fatalf("Couldn't get current key info for user %s: %v", uid, err)
	}
	userEPubKey, err := tkb.GetTLFEphemeralPublicKey(uid, cryptPublicKey)
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
	serverHalf, ok := serverMap[uid][cryptPublicKey.kid]
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
	defer CheckConfigAndShutdown(t, config1)
	config2 := ConfigAsUser(config1, "u2")
	defer CheckConfigAndShutdown(t, config2)
	config3 := ConfigAsUser(config1, "u3")
	defer CheckConfigAndShutdown(t, config3)

	ctx := context.Background()
	_, u1, err := config1.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		t.Fatalf("Couldn't get uid for user 1: %v", err)
	}
	_, u2, err := config2.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		t.Fatalf("Couldn't get uid for user 2: %v", err)
	}
	_, u3, err := config3.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		t.Fatalf("Couldn't get uid for user 3: %v", err)
	}

	// Make a tkb with empty reader and writer key maps
	tkb := TLFKeyBundle{
		TLFWriterKeyBundle: &TLFWriterKeyBundle{
			WKeys: make(UserDeviceKeyInfoMap),
			TLFEphemeralPublicKeys: make(TLFEphemeralPublicKeys, 1),
		},
		TLFReaderKeyBundle: &TLFReaderKeyBundle{
			RKeys: make(UserDeviceKeyInfoMap),
		},
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
	serverMap, err := tkb.fillInDevices(config1.Crypto(), wKeys, rKeys,
		ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1, u1, tkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config2, u2, tkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config3, u3, tkb, ePubKey, tlfCryptKey, serverMap)

	// Add a device key for user 1
	devIndex := AddDeviceForLocalUserOrBust(t, config1, u1)
	config1B := ConfigAsUser(config1, "u1")
	defer CheckConfigAndShutdown(t, config1B)
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
	serverMap2, err := tkb.fillInDevices(config1.Crypto(), wKeys, rKeys,
		ePubKey2, ePrivKey2, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1B, u1, tkb, ePubKey2, tlfCryptKey,
		serverMap2)
	if len(serverMap2) > 1 {
		t.Fatalf("Generated more than one key after device add: %d",
			len(serverMap2))
	}
}
