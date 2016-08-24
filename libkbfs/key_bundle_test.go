// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type tlfCryptKeyInfoFuture struct {
	TLFCryptKeyInfo
	extra
}

func (cki tlfCryptKeyInfoFuture) toCurrent() TLFCryptKeyInfo {
	return cki.TLFCryptKeyInfo
}

func (cki tlfCryptKeyInfoFuture) toCurrentStruct() currentStruct {
	return cki.toCurrent()
}

func makeFakeTLFCryptKeyInfoFuture(t *testing.T) tlfCryptKeyInfoFuture {
	hmac, err := DefaultHMAC([]byte("fake key"), []byte("fake buf"))
	require.NoError(t, err)
	cki := TLFCryptKeyInfo{
		EncryptedTLFCryptKeyClientHalf{
			EncryptionSecretbox,
			[]byte("fake encrypted data"),
			[]byte("fake nonce"),
		},
		TLFCryptKeyServerHalfID{hmac},
		5,
		codec.UnknownFieldSetHandler{},
	}
	return tlfCryptKeyInfoFuture{
		cki,
		makeExtraOrBust("TLFCryptKeyInfo", t),
	}
}

func TestTLFCryptKeyInfoUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFCryptKeyInfoFuture(t))
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
	wkb TLFWriterKeyBundle, ePubKey TLFEphemeralPublicKey,
	tlfCryptKey TLFCryptKey, serverMap serverKeyMap) {
	ctx := context.Background()
	// Check that every user can recover the crypt key
	cryptPublicKey, err := config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatalf("Couldn't get current public key for user %s: %v", uid, err)
	}
	info, ok := wkb.WKeys[uid][cryptPublicKey.kid]
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

	// Make a wkb with empty writer key maps
	wkb := TLFWriterKeyBundle{
		WKeys: make(UserDeviceKeyInfoMap),
		TLFEphemeralPublicKeys: make(TLFEphemeralPublicKeys, 1),
	}

	// Generate keys
	wKeys := make(map[keybase1.UID][]CryptPublicKey)

	testKeyBundleGetKeysOrBust(t, config1, u1, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u2, wKeys)
	testKeyBundleGetKeysOrBust(t, config1, u3, wKeys)

	// Fill in the bundle
	_, _, ePubKey, ePrivKey, tlfCryptKey, err :=
		config1.Crypto().MakeRandomTLFKeys()
	if err != nil {
		t.Fatalf("Couldn't make keys: %v", err)
	}
	serverMap, err := fillInDevices(
		config1.Crypto(), &wkb, &TLFReaderKeyBundle{},
		wKeys, nil, ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1, u1, wkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config2, u2, wkb, ePubKey, tlfCryptKey, serverMap)
	testKeyBundleCheckKeys(t, config3, u3, wkb, ePubKey, tlfCryptKey, serverMap)

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
	serverMap2, err := fillInDevices(
		config1.Crypto(), &wkb, &TLFReaderKeyBundle{},
		wKeys, nil, ePubKey2, ePrivKey2, tlfCryptKey)
	if err != nil {
		t.Fatalf("Fill in devices failed: %v", err)
	}

	testKeyBundleCheckKeys(t, config1B, u1, wkb, ePubKey2, tlfCryptKey,
		serverMap2)
	if len(serverMap2) > 1 {
		t.Fatalf("Generated more than one key after device add: %d",
			len(serverMap2))
	}
}

type deviceKeyInfoMapFuture map[keybase1.KID]tlfCryptKeyInfoFuture

func (dkimf deviceKeyInfoMapFuture) toCurrent() DeviceKeyInfoMap {
	dkim := make(DeviceKeyInfoMap, len(dkimf))
	for k, kif := range dkimf {
		ki := kif.toCurrent()
		dkim[k] = TLFCryptKeyInfo(ki)
	}
	return dkim
}

type userDeviceKeyInfoMapFuture map[keybase1.UID]deviceKeyInfoMapFuture

func (udkimf userDeviceKeyInfoMapFuture) toCurrent() UserDeviceKeyInfoMap {
	udkim := make(UserDeviceKeyInfoMap)
	for u, dkimf := range udkimf {
		dkim := dkimf.toCurrent()
		udkim[u] = dkim
	}
	return udkim
}

type tlfWriterKeyBundleFuture struct {
	TLFWriterKeyBundle
	// Override TLFWriterKeyBundle.WKeys.
	WKeys userDeviceKeyInfoMapFuture
	extra
}

func (wkbf tlfWriterKeyBundleFuture) toCurrent() TLFWriterKeyBundle {
	wkb := wkbf.TLFWriterKeyBundle
	wkb.WKeys = wkbf.WKeys.toCurrent()
	return wkb
}

func (wkbf tlfWriterKeyBundleFuture) toCurrentStruct() currentStruct {
	return wkbf.toCurrent()
}

func makeFakeDeviceKeyInfoMapFuture(t *testing.T) userDeviceKeyInfoMapFuture {
	return userDeviceKeyInfoMapFuture{
		"fake uid": deviceKeyInfoMapFuture{
			"fake kid": makeFakeTLFCryptKeyInfoFuture(t),
		},
	}
}

func makeFakeTLFWriterKeyBundleFuture(t *testing.T) tlfWriterKeyBundleFuture {
	wkb := TLFWriterKeyBundle{
		nil,
		MakeTLFPublicKey([32]byte{0xa}),
		TLFEphemeralPublicKeys{
			MakeTLFEphemeralPublicKey([32]byte{0xb}),
		},
		codec.UnknownFieldSetHandler{},
	}
	return tlfWriterKeyBundleFuture{
		wkb,
		makeFakeDeviceKeyInfoMapFuture(t),
		makeExtraOrBust("TLFWriterKeyBundle", t),
	}
}

func TestTLFWriterKeyBundleUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFWriterKeyBundleFuture(t))
}

type tlfReaderKeyBundleFuture struct {
	TLFReaderKeyBundle
	// Override TLFReaderKeyBundle.WKeys.
	RKeys userDeviceKeyInfoMapFuture
	extra
}

func (rkbf tlfReaderKeyBundleFuture) toCurrent() TLFReaderKeyBundle {
	rkb := rkbf.TLFReaderKeyBundle
	rkb.RKeys = rkbf.RKeys.toCurrent()
	return rkb
}

func (rkbf tlfReaderKeyBundleFuture) toCurrentStruct() currentStruct {
	return rkbf.toCurrent()
}

func makeFakeTLFReaderKeyBundleFuture(t *testing.T) tlfReaderKeyBundleFuture {
	rkb := TLFReaderKeyBundle{
		nil,
		TLFEphemeralPublicKeys{
			MakeTLFEphemeralPublicKey([32]byte{0xc}),
		},
		codec.UnknownFieldSetHandler{},
	}
	return tlfReaderKeyBundleFuture{
		rkb,
		makeFakeDeviceKeyInfoMapFuture(t),
		makeExtraOrBust("TLFReaderKeyBundle", t),
	}
}

func TestTLFReaderKeyBundleUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFReaderKeyBundleFuture(t))
}
