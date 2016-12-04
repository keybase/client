// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestRemoveDevicesNotInV3(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)

	key1a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key1b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key2a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")
	key2b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key4")
	key2c := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key5")
	key3a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key6")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half1b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half2b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x4})
	half2c := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x5})
	half3a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x6})

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1a.KID(), half1a)
	require.NoError(t, err)
	id1b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1b.KID(), half1b)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2a.KID(), half2a)
	require.NoError(t, err)
	id2b, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2b.KID(), half2b)
	require.NoError(t, err)
	id2c, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2c.KID(), half2c)
	require.NoError(t, err)
	id3a, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key3a.KID(), half3a)
	require.NoError(t, err)

	udkimV3 := UserDeviceKeyInfoMapV3{
		uid1: DeviceKeyInfoMapV3{
			key1a: TLFCryptKeyInfo{
				ServerHalfID: id1a,
				EPubKeyIndex: -1,
			},
			key1b: TLFCryptKeyInfo{
				ServerHalfID: id1b,
				EPubKeyIndex: +2,
			},
		},
		uid2: DeviceKeyInfoMapV3{
			key2a: TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: -2,
			},
			key2b: TLFCryptKeyInfo{
				ServerHalfID: id2b,
				EPubKeyIndex: 0,
			},
			key2c: TLFCryptKeyInfo{
				ServerHalfID: id2c,
				EPubKeyIndex: 0,
			},
		},
		uid3: DeviceKeyInfoMapV3{
			key3a: TLFCryptKeyInfo{
				ServerHalfID: id3a,
				EPubKeyIndex: -2,
			},
		},
	}

	removalInfo := udkimV3.removeDevicesNotIn(map[keybase1.UID][]kbfscrypto.CryptPublicKey{
		uid2: {key2a, key2c},
		uid3: {key3a},
	})

	require.Equal(t, UserDeviceKeyInfoMapV3{
		uid2: DeviceKeyInfoMapV3{
			key2a: TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: -2,
			},
			key2c: TLFCryptKeyInfo{
				ServerHalfID: id2c,
				EPubKeyIndex: 0,
			},
		},
		uid3: DeviceKeyInfoMapV3{
			key3a: TLFCryptKeyInfo{
				ServerHalfID: id3a,
				EPubKeyIndex: -2,
			},
		},
	}, udkimV3)

	require.Equal(t, ServerHalfRemovalInfo{
		uid1: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1a: []TLFCryptKeyServerHalfID{id1a},
				key1b: []TLFCryptKeyServerHalfID{id1b},
			},
		},
		uid2: userServerHalfRemovalInfo{
			userRemoved: false,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key2b: []TLFCryptKeyServerHalfID{id2b},
			},
		},
	}, removalInfo)
}

func testKeyBundleCheckKeysV3(t *testing.T, config Config, uid keybase1.UID,
	wkb TLFWriterKeyBundleV3, ePubKey kbfscrypto.TLFEphemeralPublicKey,
	tlfCryptKey kbfscrypto.TLFCryptKey, serverMap serverKeyMap) {
	ctx := context.Background()
	// Check that every user can recover the crypt key
	cryptPublicKey, err := config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatalf("Couldn't get current public key for user %s: %v", uid, err)
	}
	info, ok := wkb.Keys[uid][cryptPublicKey]
	if !ok {
		t.Fatalf("Couldn't get current key info for user %s: %v", uid, err)
	}
	if info.EPubKeyIndex < 0 || info.EPubKeyIndex >= len(wkb.TLFEphemeralPublicKeys) {
		t.Fatalf("Error getting ephemeral public key for user %s: %v", uid, err)
	}
	userEPubKey := wkb.TLFEphemeralPublicKeys[info.EPubKeyIndex]
	if g, e := userEPubKey, ePubKey; g != e {
		t.Fatalf("Unexpected ePubKey for user %s: %s vs %s", uid, g, e)
	}
	clientHalf, err := config.Crypto().DecryptTLFCryptKeyClientHalf(
		ctx, userEPubKey, info.ClientHalf)
	if err != nil {
		t.Fatalf("Couldn't decrypt client key half for user %s: %v", uid, err)
	}
	serverHalf, ok := serverMap[uid][cryptPublicKey.KID()]
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

func TestKeyBundleFillInDevicesV3(t *testing.T) {
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

	// Make a wkb with empty writer key maps
	wkb := TLFWriterKeyBundleV3{
		Keys: make(UserDeviceKeyInfoMapV3),
		TLFEphemeralPublicKeys: make(kbfscrypto.TLFEphemeralPublicKeys, 1),
	}

	// Generate keys
	wKeys := make(map[keybase1.UID][]kbfscrypto.CryptPublicKey)

	testKeyBundleGetKeysOrBust(t, config1, u1, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u2, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u3, wKeys)

	// Fill in the bundle
	_, _, ePubKey, ePrivKey, tlfCryptKey, err :=
		config1.Crypto().MakeRandomTLFKeys()
	if err != nil {
		t.Fatalf("Couldn't make keys: %v", err)
	}
	// TODO: Fix this hack.
	var md *BareRootMetadataV3
	serverMap, err := md.fillInDevices(
		config1.Crypto(), &wkb, &TLFReaderKeyBundleV3{},
		wKeys, nil, ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeysV3(t, config1, u1, wkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeysV3(t, config2, u2, wkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeysV3(t, config3, u3, wkb, ePubKey, tlfCryptKey, serverMap)

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
	serverMap2, err := md.fillInDevices(
		config1.Crypto(), &wkb, &TLFReaderKeyBundleV3{},
		wKeys, nil, ePubKey2, ePrivKey2, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeysV3(t, config1B, u1, wkb, ePubKey2, tlfCryptKey,
		serverMap2)
	if len(serverMap2) > 1 {
		t.Fatalf("Generated more than one key after device add: %d",
			len(serverMap2))
	}
}

type deviceKeyInfoMapV3Future map[kbfscrypto.CryptPublicKey]tlfCryptKeyInfoFuture

func (dkimf deviceKeyInfoMapV3Future) toCurrent() DeviceKeyInfoMapV3 {
	dkim := make(DeviceKeyInfoMapV3, len(dkimf))
	for k, kif := range dkimf {
		ki := kif.toCurrent()
		dkim[k] = TLFCryptKeyInfo(ki)
	}
	return dkim
}

type userDeviceKeyInfoMapV3Future map[keybase1.UID]deviceKeyInfoMapV3Future

func (udkimf userDeviceKeyInfoMapV3Future) toCurrent() UserDeviceKeyInfoMapV3 {
	udkim := make(UserDeviceKeyInfoMapV3)
	for u, dkimf := range udkimf {
		dkim := dkimf.toCurrent()
		udkim[u] = dkim
	}
	return udkim
}

type tlfWriterKeyBundleV3Future struct {
	TLFWriterKeyBundleV3
	// Override TLFWriterKeyBundleV3.Keys.
	Keys userDeviceKeyInfoMapV3Future `codec:"wKeys"`
	kbfscodec.Extra
}

func (wkbf tlfWriterKeyBundleV3Future) toCurrent() TLFWriterKeyBundleV3 {
	wkb := wkbf.TLFWriterKeyBundleV3
	wkb.Keys = wkbf.Keys.toCurrent()
	return wkb
}

func (wkbf tlfWriterKeyBundleV3Future) ToCurrentStruct() kbfscodec.CurrentStruct {
	return wkbf.toCurrent()
}

func makeFakeDeviceKeyInfoMapV3Future(t *testing.T) userDeviceKeyInfoMapV3Future {
	return userDeviceKeyInfoMapV3Future{
		"fake uid": deviceKeyInfoMapV3Future{
			kbfscrypto.MakeFakeCryptPublicKeyOrBust("fake key"): makeFakeTLFCryptKeyInfoFuture(t),
		},
	}
}

func makeFakeTLFWriterKeyBundleV3Future(t *testing.T) tlfWriterKeyBundleV3Future {
	wkb := TLFWriterKeyBundleV3{
		nil,
		kbfscrypto.MakeTLFPublicKey([32]byte{0xa}),
		kbfscrypto.TLFEphemeralPublicKeys{
			kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0xb}),
		},
		EncryptedTLFCryptKeys{},
		codec.UnknownFieldSetHandler{},
	}
	return tlfWriterKeyBundleV3Future{
		wkb,
		makeFakeDeviceKeyInfoMapV3Future(t),
		kbfscodec.MakeExtraOrBust("TLFWriterKeyBundleV3", t),
	}
}

func TestTLFWriterKeyBundleV3UnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFWriterKeyBundleV3Future(t))
}

type tlfReaderKeyBundleV3Future struct {
	TLFReaderKeyBundleV3
	// Override TLFReaderKeyBundleV3.Keys.
	Keys userDeviceKeyInfoMapV3Future `codec:"rKeys"`
	kbfscodec.Extra
}

func (rkbf tlfReaderKeyBundleV3Future) toCurrent() TLFReaderKeyBundleV3 {
	rkb := rkbf.TLFReaderKeyBundleV3
	rkb.Keys = rkbf.Keys.toCurrent()
	return rkb
}

func (rkbf tlfReaderKeyBundleV3Future) ToCurrentStruct() kbfscodec.CurrentStruct {
	return rkbf.toCurrent()
}

func makeFakeTLFReaderKeyBundleV3Future(
	t *testing.T) tlfReaderKeyBundleV3Future {
	rkb := TLFReaderKeyBundleV3{
		nil,
		kbfscrypto.TLFEphemeralPublicKeys{
			kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0xc}),
		},
		codec.UnknownFieldSetHandler{},
	}
	return tlfReaderKeyBundleV3Future{
		rkb,
		makeFakeDeviceKeyInfoMapV3Future(t),
		kbfscodec.MakeExtraOrBust("TLFReaderKeyBundleV3", t),
	}
}

func TestTLFReaderKeyBundleV3UnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFReaderKeyBundleV3Future(t))
}
