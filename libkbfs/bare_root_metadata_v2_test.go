// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func TestBareRootMetadataVersionV2(t *testing.T) {
	tlfID := tlf.FakeID(1, false)

	// Metadata objects with unresolved assertions should have
	// InitialExtraMetadataVer.

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UID{uid}, nil, []keybase1.SocialAssertion{{}},
		nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV2(tlfID, bh)
	require.NoError(t, err)

	require.Equal(t, InitialExtraMetadataVer, rmd.Version())

	// All other folders should use PreExtraMetadataVer.
	bh2, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	rmd2, err := MakeInitialBareRootMetadata(
		InitialExtraMetadataVer, tlfID, bh2)
	require.NoError(t, err)

	require.Equal(t, PreExtraMetadataVer, rmd2.Version())

	// ... including if unresolved assertions get resolved.

	rmd.SetUnresolvedWriters(nil)
	require.Equal(t, PreExtraMetadataVer, rmd.Version())
}

func TestIsValidRekeyRequestBasicV2(t *testing.T) {
	tlfID := tlf.FakeID(1, false)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadataV2(tlfID, bh)
	require.NoError(t, err)

	ctx := context.Background()
	codec := kbfscodec.NewMsgpack()
	signer := kbfscrypto.SigningKeySigner{
		Key: kbfscrypto.MakeFakeSigningKeyOrBust("key1"),
	}

	err = brmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)

	newBrmd, err := MakeInitialBareRootMetadataV2(tlfID, bh)
	require.NoError(t, err)
	ok, err := newBrmd.IsValidRekeyRequest(
		codec, brmd, newBrmd.LastModifyingWriter(), nil, nil)
	require.NoError(t, err)
	// Should fail because the copy bit is unset.
	require.False(t, ok)

	// Set the copy bit; note the writer metadata is the same.
	newBrmd.SetWriterMetadataCopiedBit()

	signer2 := kbfscrypto.SigningKeySigner{
		Key: kbfscrypto.MakeFakeSigningKeyOrBust("key2"),
	}

	err = newBrmd.SignWriterMetadataInternally(ctx, codec, signer2)
	require.NoError(t, err)

	ok, err = newBrmd.IsValidRekeyRequest(
		codec, brmd, newBrmd.LastModifyingWriter(), nil, nil)
	require.NoError(t, err)
	// Should fail because of mismatched writer metadata siginfo.
	require.False(t, ok)

	// Re-sign to get the same signature.
	err = newBrmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)
	ok, err = newBrmd.IsValidRekeyRequest(
		codec, brmd, newBrmd.LastModifyingWriter(), nil, nil)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestRevokeRemovedDevicesV2(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)

	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key3 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half1b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half2b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x4})
	half3a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x5})
	half3b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x6})

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1a)
	require.NoError(t, err)
	id1b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1b)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2, half2a)
	require.NoError(t, err)
	id2b, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2, half2b)
	require.NoError(t, err)
	id3a, err := crypto.GetTLFCryptKeyServerHalfID(uid3, key3, half3a)
	require.NoError(t, err)
	id3b, err := crypto.GetTLFCryptKeyServerHalfID(uid3, key3, half3b)
	require.NoError(t, err)

	tlfID := tlf.FakeID(1, false)

	bh, err := tlf.MakeHandle(
		[]keybase1.UID{uid1, uid2}, []keybase1.UID{uid3}, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadataV2(tlfID, bh)
	require.NoError(t, err)

	brmd.WKeys = TLFWriterKeyGenerationsV2{
		TLFWriterKeyBundleV2{
			WKeys: UserDeviceKeyInfoMapV2{
				uid1: DeviceKeyInfoMapV2{
					key1.KID(): TLFCryptKeyInfo{
						ServerHalfID: id1a,
						EPubKeyIndex: 0,
					},
				},
				uid2: DeviceKeyInfoMapV2{
					key2.KID(): TLFCryptKeyInfo{
						ServerHalfID: id2a,
						EPubKeyIndex: 1,
					},
				},
			},
		},
		TLFWriterKeyBundleV2{
			WKeys: UserDeviceKeyInfoMapV2{
				uid1: DeviceKeyInfoMapV2{
					key1.KID(): TLFCryptKeyInfo{
						ServerHalfID: id1b,
						EPubKeyIndex: 0,
					},
				},
				uid2: DeviceKeyInfoMapV2{
					key2.KID(): TLFCryptKeyInfo{
						ServerHalfID: id2b,
						EPubKeyIndex: 0,
					},
				},
			},
		},
	}

	brmd.RKeys = TLFReaderKeyGenerationsV2{
		TLFReaderKeyBundleV2{
			RKeys: UserDeviceKeyInfoMapV2{
				uid3: DeviceKeyInfoMapV2{
					key3.KID(): TLFCryptKeyInfo{
						ServerHalfID: id3a,
						EPubKeyIndex: 0,
					},
				},
			},
		},
		TLFReaderKeyBundleV2{
			RKeys: UserDeviceKeyInfoMapV2{
				uid3: DeviceKeyInfoMapV2{
					key3.KID(): TLFCryptKeyInfo{
						ServerHalfID: id3b,
						EPubKeyIndex: 0,
					},
				},
			},
		},
	}

	wKeys := UserDevicePublicKeys{
		uid1: {key1: true},
	}
	rKeys := UserDevicePublicKeys{
		uid3: {key3: true},
	}

	removalInfo, err := brmd.RevokeRemovedDevices(wKeys, rKeys, nil)
	require.NoError(t, err)
	require.Equal(t, ServerHalfRemovalInfo{
		uid2: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key2: []TLFCryptKeyServerHalfID{id2a, id2b},
			},
		},
	}, removalInfo)

	expectedWKeys := TLFWriterKeyGenerationsV2{
		TLFWriterKeyBundleV2{
			WKeys: UserDeviceKeyInfoMapV2{
				uid1: DeviceKeyInfoMapV2{
					key1.KID(): TLFCryptKeyInfo{
						ServerHalfID: id1a,
						EPubKeyIndex: 0,
					},
				},
			},
		},
		TLFWriterKeyBundleV2{
			WKeys: UserDeviceKeyInfoMapV2{
				uid1: DeviceKeyInfoMapV2{
					key1.KID(): TLFCryptKeyInfo{
						ServerHalfID: id1b,
						EPubKeyIndex: 0,
					},
				},
			},
		},
	}
	require.Equal(t, expectedWKeys, brmd.WKeys)

	expectedRKeys := TLFReaderKeyGenerationsV2{
		TLFReaderKeyBundleV2{
			RKeys: UserDeviceKeyInfoMapV2{
				uid3: DeviceKeyInfoMapV2{
					key3.KID(): TLFCryptKeyInfo{
						ServerHalfID: id3a,
						EPubKeyIndex: 0,
					},
				},
			},
		},
		TLFReaderKeyBundleV2{
			RKeys: UserDeviceKeyInfoMapV2{
				uid3: DeviceKeyInfoMapV2{
					key3.KID(): TLFCryptKeyInfo{
						ServerHalfID: id3b,
						EPubKeyIndex: 0,
					},
				},
			},
		},
	}
	require.Equal(t, expectedRKeys, brmd.RKeys)
}

// userDeviceSet is a map from users to that user's set of devices,
// represented by each device's crypt public key.
type userDeviceSet map[keybase1.UID]map[kbfscrypto.CryptPublicKey]bool

// union returns the union of the user's keys in uds and other. For a
// particular user, it's assumed that that user's keys in uds and
// other are disjoint.
func (uds userDeviceSet) union(other userDeviceSet) userDeviceSet {
	u := make(userDeviceSet)
	for uid, keys := range uds {
		u[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		for key := range keys {
			u[uid][key] = true
		}
	}
	for uid, keys := range other {
		if u[uid] == nil {
			u[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		}
		for key := range keys {
			if u[uid][key] {
				panic(fmt.Sprintf(
					"uid=%s key=%s exists in both",
					uid, key))
			}
			u[uid][key] = true
		}
	}
	return u
}

// userDevicePrivateKeys is a map from users to that user's set of
// device private keys.
type userDevicePrivateKeys map[keybase1.UID]map[kbfscrypto.CryptPrivateKey]bool

func (udpk userDevicePrivateKeys) toPublicKeys() UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, privKeys := range udpk {
		for privKey := range privKeys {
			pubKey := privKey.GetPublicKey()
			if pubKeys[uid] == nil {
				pubKeys[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
			}
			pubKeys[uid][pubKey] = true
		}
	}
	return pubKeys
}

// expectedRekeyInfoV2 contains all the information needed to check a
// rekey run (that doesn't add a generation).
//
// If both writerPrivKeys and readerPrivKeys are empty, then
// ePubKeyIndex and ePubKey are ignored.
type expectedRekeyInfoV2 struct {
	writerPrivKeys, readerPrivKeys userDevicePrivateKeys
	serverHalves                   UserDeviceKeyServerHalves
	ePubKeyIndex                   int
	ePubKey                        kbfscrypto.TLFEphemeralPublicKey
}

func checkCryptKeyInfo(t *testing.T, privKey kbfscrypto.CryptPrivateKey,
	serverHalf kbfscrypto.TLFCryptKeyServerHalf, expectedEPubKeyIndex int,
	expectedEPubKey kbfscrypto.TLFEphemeralPublicKey,
	expectedTLFCryptKey kbfscrypto.TLFCryptKey, info TLFCryptKeyInfo,
	ePubKey kbfscrypto.TLFEphemeralPublicKey) {
	dummySigningKey := kbfscrypto.MakeFakeSigningKeyOrBust("dummy")
	codec := kbfscodec.NewMsgpack()
	crypto := NewCryptoLocal(codec, dummySigningKey, privKey)

	require.Equal(t, expectedEPubKeyIndex, info.EPubKeyIndex)
	require.Equal(t, expectedEPubKey, ePubKey)

	ctx := context.Background()
	clientHalf, err := crypto.DecryptTLFCryptKeyClientHalf(
		ctx, ePubKey, info.ClientHalf)
	require.NoError(t, err)

	tlfCryptKey, err := crypto.UnmaskTLFCryptKey(serverHalf, clientHalf)
	require.NoError(t, err)
	require.Equal(t, expectedTLFCryptKey, tlfCryptKey)
}

// checkGetTLFCryptKeyV2 checks that wkb and rkb contain the info
// necessary to get the TLF crypt key for each user in expected, which
// must all match expectedTLFCryptKey.
func checkGetTLFCryptKeyV2(t *testing.T, expected expectedRekeyInfoV2,
	expectedTLFCryptKey kbfscrypto.TLFCryptKey,
	wkb *TLFWriterKeyBundleV2, rkb *TLFReaderKeyBundleV2) {
	for uid, privKeys := range expected.writerPrivKeys {
		for privKey := range privKeys {
			pubKey := privKey.GetPublicKey()
			serverHalf, ok := expected.serverHalves[uid][pubKey]
			require.True(t, ok, "writer uid=%s, key=%s",
				uid, pubKey)

			info, ok := wkb.WKeys[uid][pubKey.KID()]
			require.True(t, ok)

			ePubKey := wkb.TLFEphemeralPublicKeys[info.EPubKeyIndex]

			checkCryptKeyInfo(t, privKey, serverHalf,
				expected.ePubKeyIndex, expected.ePubKey,
				expectedTLFCryptKey, info, ePubKey)
		}
	}

	for uid, privKeys := range expected.readerPrivKeys {
		for privKey := range privKeys {
			pubKey := privKey.GetPublicKey()
			serverHalf, ok := expected.serverHalves[uid][pubKey]
			require.True(t, ok, "reader uid=%s, key=%s",
				uid, pubKey)

			info, ok := rkb.RKeys[uid][pubKey.KID()]
			require.True(t, ok)

			_, _, ePubKey, err := getEphemeralPublicKeyInfoV2(
				info, wkb, rkb)
			require.NoError(t, err)

			checkCryptKeyInfo(t, privKey, serverHalf,
				expected.ePubKeyIndex, expected.ePubKey,
				expectedTLFCryptKey, info, ePubKey)
		}
	}
}

// accumulatePublicKeys returns the union of each user's keys in
// pubKeys1 and pubKeys2. A user's keys in pubKeys1 and pubKeys2 must
// be disjoint.
func accumulatePublicKeys(
	pubKeys1, pubKeys2 UserDevicePublicKeys) UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, keys := range pubKeys1 {
		pubKeys[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		for key := range keys {
			pubKeys[uid][key] = true
		}
	}
	for uid, keys := range pubKeys2 {
		if pubKeys[uid] == nil {
			pubKeys[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		}
		for key := range keys {
			if pubKeys[uid][key] {
				panic(fmt.Sprintf(
					"uid=%s key=%s exists in both",
					uid, key))
			}
			pubKeys[uid][key] = true
		}
	}
	return pubKeys
}

// unionPublicKeyUsers returns the union of the usersin pubKeys1 and
// pubKeys2, which must be disjoint. Not a deep copy.
func unionPublicKeyUsers(
	pubKeys1, pubKeys2 UserDevicePublicKeys) UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, keys := range pubKeys1 {
		pubKeys[uid] = keys
	}
	for uid, keys := range pubKeys2 {
		if pubKeys[uid] != nil {
			panic(fmt.Sprintf("uid=%s exists in both", uid))
		}
		pubKeys[uid] = keys
	}
	return pubKeys
}

func userDeviceKeyInfoMapV2ToPublicKeys(
	udkimV2 UserDeviceKeyInfoMapV2) UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, dkimV2 := range udkimV2 {
		pubKeys[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		for kid := range dkimV2 {
			pubKeys[uid][kbfscrypto.MakeCryptPublicKey(kid)] = true
		}
	}
	return pubKeys
}

func userDeviceServerHalvesToPublicKeys(serverHalves UserDeviceKeyServerHalves) UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, keys := range serverHalves {
		pubKeys[uid] = make(map[kbfscrypto.CryptPublicKey]bool)
		for key := range keys {
			pubKeys[uid][key] = true
		}
	}
	return pubKeys
}

// checkKeyBundlesV2 checks that wkb and rkb contain exactly the info
// expected from expectedRekeyInfos and expectedPubKey.
func checkKeyBundlesV2(t *testing.T, expectedRekeyInfos []expectedRekeyInfoV2,
	expectedTLFCryptKey kbfscrypto.TLFCryptKey,
	expectedPubKey kbfscrypto.TLFPublicKey,
	wkb *TLFWriterKeyBundleV2, rkb *TLFReaderKeyBundleV2) {
	expectedWriterPubKeys := make(UserDevicePublicKeys)
	expectedReaderPubKeys := make(UserDevicePublicKeys)
	var expectedWriterEPublicKeys,
		expectedReaderEPublicKeys kbfscrypto.TLFEphemeralPublicKeys
	for _, expected := range expectedRekeyInfos {
		expectedWriterPubKeys = accumulatePublicKeys(
			expectedWriterPubKeys,
			expected.writerPrivKeys.toPublicKeys())
		expectedReaderPubKeys = accumulatePublicKeys(
			expectedReaderPubKeys,
			expected.readerPrivKeys.toPublicKeys())
		if len(expected.writerPrivKeys)+
			len(expected.readerPrivKeys) > 0 {
			if expected.ePubKeyIndex >= 0 {
				require.Equal(t, expected.ePubKeyIndex,
					len(expectedWriterEPublicKeys))
				expectedWriterEPublicKeys = append(
					expectedWriterEPublicKeys,
					expected.ePubKey)
			} else {
				i := -1 - expected.ePubKeyIndex
				require.Equal(t, i,
					len(expectedReaderEPublicKeys))
				expectedReaderEPublicKeys = append(
					expectedReaderEPublicKeys,
					expected.ePubKey)
			}
		}
	}

	writerPubKeys := userDeviceKeyInfoMapV2ToPublicKeys(wkb.WKeys)
	readerPubKeys := userDeviceKeyInfoMapV2ToPublicKeys(rkb.RKeys)

	require.Equal(t, expectedWriterPubKeys, writerPubKeys)
	require.Equal(t, expectedReaderPubKeys, readerPubKeys)

	require.Equal(t, expectedWriterEPublicKeys, wkb.TLFEphemeralPublicKeys)
	require.Equal(t, expectedReaderEPublicKeys, rkb.TLFReaderEphemeralPublicKeys)

	require.Equal(t, expectedPubKey, wkb.TLFPublicKey)

	for _, expected := range expectedRekeyInfos {
		expectedUserPubKeys := unionPublicKeyUsers(
			expected.writerPrivKeys.toPublicKeys(),
			expected.readerPrivKeys.toPublicKeys())
		userPubKeys := userDeviceServerHalvesToPublicKeys(
			expected.serverHalves)
		require.Equal(t, expectedUserPubKeys, userPubKeys)
		checkGetTLFCryptKeyV2(t,
			expected, expectedTLFCryptKey, wkb, rkb)
	}
}

func TestBareRootMetadataV2UpdateKeyGeneration(t *testing.T) {
	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	uid3 := keybase1.MakeTestUID(3)

	privKey1 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1")
	privKey2 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key2")
	privKey3 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3")

	wKeys := UserDevicePublicKeys{
		uid1: {privKey1.GetPublicKey(): true},
		uid2: {privKey2.GetPublicKey(): true},
	}

	rKeys := UserDevicePublicKeys{
		uid3: {privKey3.GetPublicKey(): true},
	}

	tlfID := tlf.FakeID(1, false)

	bh, err := tlf.MakeHandle(
		[]keybase1.UID{uid1, uid2}, []keybase1.UID{uid3},
		[]keybase1.SocialAssertion{{}},
		nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV2(tlfID, bh)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)

	pubKey, _, ePubKey1, ePrivKey1, tlfCryptKey, err :=
		crypto.MakeRandomTLFKeys()
	require.NoError(t, err)

	// Add and update first key generation.

	extra, err := rmd.AddKeyGeneration(codec, crypto, nil,
		kbfscrypto.TLFCryptKey{}, kbfscrypto.TLFCryptKey{}, pubKey)
	require.NoError(t, err)

	wkb, rkb, err := rmd.getTLFKeyBundles(FirstValidKeyGen)
	require.NoError(t, err)

	var expectedRekeyInfos []expectedRekeyInfoV2
	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	serverHalves1, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey1, ePrivKey1, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo1 := expectedRekeyInfoV2{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1: true},
			uid2: {privKey2: true},
		},
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3: true},
		},
		serverHalves: serverHalves1,
		ePubKeyIndex: 0,
		ePubKey:      ePubKey1,
	}
	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo1)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves1b, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey1, ePrivKey1, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo1b := expectedRekeyInfoV2{
		serverHalves: serverHalves1b,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo1b)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Rekey.

	privKey1b := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1b")
	wKeys[uid1][privKey1b.GetPublicKey()] = true

	privKey3b := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3b")
	rKeys[uid3][privKey3b.GetPublicKey()] = true

	_, _, ePubKey2, ePrivKey2, _, err := crypto.MakeRandomTLFKeys()
	require.NoError(t, err)

	serverHalves2, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey2, ePrivKey2, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo2 := expectedRekeyInfoV2{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1b: true},
		},
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3b: true},
		},
		serverHalves: serverHalves2,
		ePubKeyIndex: 1,
		ePubKey:      ePubKey2,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo2)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves2b, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey2, ePrivKey2, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo2b := expectedRekeyInfoV2{
		serverHalves: serverHalves2b,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo2b)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Rekey writers only.

	privKey1c := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1c")
	wKeys[uid1][privKey1c.GetPublicKey()] = true

	_, _, ePubKey3, ePrivKey3, _, err := crypto.MakeRandomTLFKeys()
	require.NoError(t, err)

	serverHalves3, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey3, ePrivKey3, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo3 := expectedRekeyInfoV2{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1c: true},
		},
		readerPrivKeys: nil,
		serverHalves:   serverHalves3,
		ePubKeyIndex:   2,
		ePubKey:        ePubKey3,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo3)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves3b, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, wKeys, rKeys, ePubKey3, ePrivKey3, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo3b := expectedRekeyInfoV2{
		serverHalves: serverHalves3b,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo3b)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Reader rekey.

	privKey3c := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3c")
	privKey3d := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3d")
	rKeys[uid3][privKey3c.GetPublicKey()] = true
	rKeys[uid3][privKey3d.GetPublicKey()] = true

	_, _, ePubKey4, ePrivKey4, _, err := crypto.MakeRandomTLFKeys()
	require.NoError(t, err)

	rKeysReader := UserDevicePublicKeys{
		uid3: rKeys[uid3],
	}
	serverHalves4, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, nil, rKeysReader, ePubKey4, ePrivKey4, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo4 := expectedRekeyInfoV2{
		writerPrivKeys: nil,
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3c: true, privKey3d: true},
		},
		serverHalves: serverHalves4,
		ePubKeyIndex: -1,
		ePubKey:      ePubKey4,
	}
	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo4)
	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves4b, err := rmd.UpdateKeyGeneration(crypto, FirstValidKeyGen,
		extra, nil, rKeysReader, ePubKey4, ePrivKey4, tlfCryptKey)
	require.NoError(t, err)

	expectedRekeyInfo4b := expectedRekeyInfoV2{
		serverHalves: serverHalves4b,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo4b)

	checkKeyBundlesV2(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)
}
