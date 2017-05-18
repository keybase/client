// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func TestBareRootMetadataVersionV3(t *testing.T) {
	tlfID := tlf.FakeID(1, tlf.Private)

	// All V3 objects should have SegregatedKeyBundlesVer.

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	require.Equal(t, SegregatedKeyBundlesVer, rmd.Version())
}

func TestRootMetadataV3ExtraNew(t *testing.T) {
	tlfID := tlf.FakeID(1, tlf.Private)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	extra := FakeInitialRekey(rmd, bh, kbfscrypto.TLFPublicKey{})
	extraV3, ok := extra.(*ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extraV3.wkbNew)
	require.True(t, extraV3.rkbNew)

	err = rmd.FinalizeRekey(crypto, extra)
	require.NoError(t, err)
	require.True(t, extraV3.wkbNew)
	require.True(t, extraV3.rkbNew)

	_, extraCopy, err := rmd.MakeSuccessorCopy(
		codec, nil, extra, -1, nil, true)
	require.NoError(t, err)

	extraV3Copy, ok := extraCopy.(*ExtraMetadataV3)
	require.True(t, ok)
	require.False(t, extraV3Copy.wkbNew)
	require.False(t, extraV3Copy.rkbNew)
}

func TestIsValidRekeyRequestBasicV3(t *testing.T) {
	tlfID := tlf.FakeID(1, tlf.Private)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()

	brmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)
	extra := FakeInitialRekey(brmd, bh, kbfscrypto.TLFPublicKey{})

	newBrmd, err := brmd.DeepCopy(codec)
	require.NoError(t, err)
	newExtra, err := extra.DeepCopy(codec)
	require.NoError(t, err)

	ok, err := newBrmd.IsValidRekeyRequest(
		codec, brmd, newBrmd.LastModifyingWriter(), extra, newExtra)
	require.NoError(t, err)
	// Should fail because the copy bit is unset.
	require.False(t, ok)

	// Set the copy bit; note the writer metadata is the same.
	newBrmd.SetWriterMetadataCopiedBit()

	// There's no internal signature to compare, so this should
	// then work.

	ok, err = newBrmd.IsValidRekeyRequest(
		codec, brmd, newBrmd.LastModifyingWriter(), extra, newExtra)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestBareRootMetadataPublicVersionV3(t *testing.T) {
	tlfID := tlf.FakeID(1, tlf.Public)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()},
		[]keybase1.UserOrTeamID{keybase1.UserOrTeamID(keybase1.PublicUID)},
		nil, nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)
	require.Equal(t, SegregatedKeyBundlesVer, rmd.Version())

	bh2, err := rmd.MakeBareTlfHandle(nil)
	require.Equal(t, bh, bh2)
}

func TestRevokeRemovedDevicesV3(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)

	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key3 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half3a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x5})

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1a)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2, half2a)
	require.NoError(t, err)
	id3a, err := crypto.GetTLFCryptKeyServerHalfID(uid3, key3, half3a)
	require.NoError(t, err)

	tlfID := tlf.FakeID(1, tlf.Private)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid1.AsUserOrTeam(), uid2.AsUserOrTeam()},
		[]keybase1.UserOrTeamID{uid3.AsUserOrTeam()}, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	extra := FakeInitialRekey(brmd, bh, kbfscrypto.TLFPublicKey{})

	wkb, rkb, err := brmd.getTLFKeyBundles(extra)
	require.NoError(t, err)

	*wkb = TLFWriterKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1: TLFCryptKeyInfo{
					ServerHalfID: id1a,
					EPubKeyIndex: 0,
				},
			},
			uid2: DeviceKeyInfoMapV3{
				key2: TLFCryptKeyInfo{
					ServerHalfID: id2a,
					EPubKeyIndex: 0,
				},
			},
		},
	}

	*rkb = TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid3: DeviceKeyInfoMapV3{
				key3: TLFCryptKeyInfo{
					ServerHalfID: id3a,
					EPubKeyIndex: 0,
				},
			},
		},
	}

	updatedWriterKeys := UserDevicePublicKeys{
		uid1: {key1: true},
	}
	updatedReaderKeys := UserDevicePublicKeys{
		uid3: {key3: true},
	}

	removalInfo, err := brmd.RevokeRemovedDevices(
		updatedWriterKeys, updatedReaderKeys, extra)
	require.NoError(t, err)
	require.Equal(t, ServerHalfRemovalInfo{
		uid2: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key2: []TLFCryptKeyServerHalfID{id2a},
			},
		},
	}, removalInfo)

	expectedWKB := TLFWriterKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1: TLFCryptKeyInfo{
					ServerHalfID: id1a,
					EPubKeyIndex: 0,
				},
			},
		},
	}
	require.Equal(t, expectedWKB, *wkb)

	expectedRKB := TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid3: DeviceKeyInfoMapV3{
				key3: TLFCryptKeyInfo{
					ServerHalfID: id3a,
					EPubKeyIndex: 0,
				},
			},
		},
	}
	require.Equal(t, expectedRKB, *rkb)
}

// TestRevokeLastDeviceV3 checks behavior of RevokeRemovedDevices with
// respect to removing the last device of a user vs. removing the user
// completely.
func TestRevokeLastDeviceV3(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)
	uid4 := keybase1.MakeTestUID(0x4)

	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")

	half1 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half2 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1)
	require.NoError(t, err)
	id2, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2, half2)
	require.NoError(t, err)

	tlfID := tlf.FakeID(1, tlf.Private)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid1.AsUserOrTeam(), uid2.AsUserOrTeam()},
		[]keybase1.UserOrTeamID{uid3.AsUserOrTeam(), uid4.AsUserOrTeam()},
		nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	extra := FakeInitialRekey(brmd, bh, kbfscrypto.TLFPublicKey{})

	wkb, rkb, err := brmd.getTLFKeyBundles(extra)
	require.NoError(t, err)

	*wkb = TLFWriterKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1: TLFCryptKeyInfo{
					ServerHalfID: id1,
					EPubKeyIndex: 0,
				},
			},
			uid2: DeviceKeyInfoMapV3{
				key2: TLFCryptKeyInfo{
					ServerHalfID: id2,
					EPubKeyIndex: 1,
				},
			},
		},
	}

	*rkb = TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid3: DeviceKeyInfoMapV3{},
			uid4: DeviceKeyInfoMapV3{},
		},
	}

	updatedWriterKeys := UserDevicePublicKeys{
		uid1: {},
	}
	updatedReaderKeys := UserDevicePublicKeys{
		uid3: {},
	}

	removalInfo, err := brmd.RevokeRemovedDevices(
		updatedWriterKeys, updatedReaderKeys, extra)
	require.NoError(t, err)
	require.Equal(t, ServerHalfRemovalInfo{
		uid1: userServerHalfRemovalInfo{
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1: []TLFCryptKeyServerHalfID{id1},
			},
		},
		uid2: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key2: []TLFCryptKeyServerHalfID{id2},
			},
		},
		uid4: userServerHalfRemovalInfo{
			userRemoved:         true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{},
		},
	}, removalInfo)

	expectedWKB := TLFWriterKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{},
		},
	}
	require.Equal(t, expectedWKB, *wkb)

	expectedRKB := TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid3: DeviceKeyInfoMapV3{},
		},
	}
	require.Equal(t, expectedRKB, *rkb)
}

// expectedRekeyInfoV3 contains all the information needed to check a
// rekey run (that doesn't add a generation).
//
// If writerPrivKeys is empty, then writerEPubKeyIndex is ignored, and
// similarly for readerPrivKeys. If both are empty, then ePubKey is
// also ignored.
type expectedRekeyInfoV3 struct {
	writerPrivKeys, readerPrivKeys         userDevicePrivateKeys
	serverHalves                           UserDeviceKeyServerHalves
	writerEPubKeyIndex, readerEPubKeyIndex int
	ePubKey                                kbfscrypto.TLFEphemeralPublicKey
}

// checkGetTLFCryptKeyV3 checks that wkb and rkb contain the info
// necessary to get the TLF crypt key for each user in expected, which
// must all match expectedTLFCryptKey.
func checkGetTLFCryptKeyV3(t *testing.T, expected expectedRekeyInfoV3,
	expectedTLFCryptKey kbfscrypto.TLFCryptKey,
	wkb *TLFWriterKeyBundleV3, rkb *TLFReaderKeyBundleV3) {
	for uid, privKeys := range expected.writerPrivKeys {
		for privKey := range privKeys {
			pubKey := privKey.GetPublicKey()
			serverHalf, ok := expected.serverHalves[uid][pubKey]
			require.True(t, ok, "writer uid=%s, key=%s",
				uid, pubKey)

			info, ok := wkb.Keys[uid][pubKey]
			require.True(t, ok)

			ePubKey := wkb.TLFEphemeralPublicKeys[info.EPubKeyIndex]

			checkCryptKeyInfo(t, privKey, serverHalf,
				expected.writerEPubKeyIndex, expected.ePubKey,
				expectedTLFCryptKey, info, ePubKey)
		}
	}

	for uid, privKeys := range expected.readerPrivKeys {
		for privKey := range privKeys {
			pubKey := privKey.GetPublicKey()
			serverHalf, ok := expected.serverHalves[uid][pubKey]
			require.True(t, ok, "reader uid=%s, key=%s",
				uid, pubKey)

			info, ok := rkb.Keys[uid][pubKey]
			require.True(t, ok)

			ePubKey := rkb.TLFEphemeralPublicKeys[info.EPubKeyIndex]

			checkCryptKeyInfo(t, privKey, serverHalf,
				expected.readerEPubKeyIndex, expected.ePubKey,
				expectedTLFCryptKey, info, ePubKey)
		}
	}
}

func userDeviceKeyInfoMapV3ToPublicKeys(udkimV3 UserDeviceKeyInfoMapV3) UserDevicePublicKeys {
	pubKeys := make(UserDevicePublicKeys)
	for uid, dkimV3 := range udkimV3 {
		pubKeys[uid] = make(DevicePublicKeys)
		for key := range dkimV3 {
			pubKeys[uid][key] = true
		}
	}
	return pubKeys
}

// checkKeyBundlesV3 checks that wkb and rkb contain exactly the info
// expected from expectedRekeyInfos and expectedPubKey.
func checkKeyBundlesV3(t *testing.T, expectedRekeyInfos []expectedRekeyInfoV3,
	expectedTLFCryptKey kbfscrypto.TLFCryptKey,
	expectedPubKey kbfscrypto.TLFPublicKey,
	wkb *TLFWriterKeyBundleV3, rkb *TLFReaderKeyBundleV3) {
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

		if expected.writerPrivKeys.hasKeys() {
			require.Equal(t, expected.writerEPubKeyIndex,
				len(expectedWriterEPublicKeys))
			expectedWriterEPublicKeys = append(
				expectedWriterEPublicKeys,
				expected.ePubKey)
		}

		if expected.readerPrivKeys.hasKeys() {
			require.Equal(t, expected.readerEPubKeyIndex,
				len(expectedReaderEPublicKeys))
			expectedReaderEPublicKeys = append(
				expectedReaderEPublicKeys,
				expected.ePubKey)
		}
	}

	writerPubKeys := userDeviceKeyInfoMapV3ToPublicKeys(wkb.Keys)
	readerPubKeys := userDeviceKeyInfoMapV3ToPublicKeys(rkb.Keys)

	require.Equal(t, expectedWriterPubKeys, writerPubKeys)
	require.Equal(t, expectedReaderPubKeys, readerPubKeys)

	require.Equal(t, expectedWriterEPublicKeys, wkb.TLFEphemeralPublicKeys)
	require.Equal(t, expectedReaderEPublicKeys, rkb.TLFEphemeralPublicKeys)

	require.Equal(t, expectedPubKey, wkb.TLFPublicKey)

	for _, expected := range expectedRekeyInfos {
		expectedUserPubKeys := unionPublicKeyUsers(
			expected.writerPrivKeys.toPublicKeys(),
			expected.readerPrivKeys.toPublicKeys())
		userPubKeys := userDeviceServerHalvesToPublicKeys(
			expected.serverHalves)
		require.Equal(t, expectedUserPubKeys.removeKeylessUsersForTest(), userPubKeys)
		checkGetTLFCryptKeyV3(t,
			expected, expectedTLFCryptKey, wkb, rkb)
	}
}

func TestBareRootMetadataV3UpdateKeyBundles(t *testing.T) {
	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	uid3 := keybase1.MakeTestUID(3)

	privKey1 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1")
	privKey2 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key2")
	privKey3 := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3")

	updatedWriterKeys := UserDevicePublicKeys{
		uid1: {privKey1.GetPublicKey(): true},
		uid2: {privKey2.GetPublicKey(): true},
	}

	updatedReaderKeys := UserDevicePublicKeys{
		uid3: {privKey3.GetPublicKey(): true},
	}

	tlfID := tlf.FakeID(1, tlf.Private)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid1.AsUserOrTeam(), uid2.AsUserOrTeam()},
		[]keybase1.UserOrTeamID{uid3.AsUserOrTeam()},
		[]keybase1.SocialAssertion{{}},
		nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)

	ePubKey1, ePrivKey1, err := crypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	// Add first key generations, although only the last one
	// matters.

	latestKeyGen := FirstValidKeyGen + 5
	var pubKey kbfscrypto.TLFPublicKey
	var tlfCryptKey kbfscrypto.TLFCryptKey
	var extra ExtraMetadata
	var serverHalves1 UserDeviceKeyServerHalves
	for keyGen := FirstValidKeyGen; keyGen <= latestKeyGen; keyGen++ {
		fakeKeyData := [32]byte{byte(keyGen)}
		pubKey = kbfscrypto.MakeTLFPublicKey(fakeKeyData)
		nextTLFCryptKey := kbfscrypto.MakeTLFCryptKey(fakeKeyData)

		// Use the same ephemeral keys for initial key
		// generations, even though that can't happen in
		// practice.
		var err error
		extra, serverHalves1, err = rmd.AddKeyGeneration(codec,
			crypto, extra, updatedWriterKeys, updatedReaderKeys,
			ePubKey1, ePrivKey1,
			pubKey, tlfCryptKey, nextTLFCryptKey)
		require.NoError(t, err)

		tlfCryptKey = nextTLFCryptKey
	}

	wkb, rkb, err := rmd.getTLFKeyBundles(extra)
	require.NoError(t, err)

	expectedRekeyInfo1 := expectedRekeyInfoV3{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1: true},
			uid2: {privKey2: true},
		},
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3: true},
		},
		serverHalves:       serverHalves1,
		writerEPubKeyIndex: 0,
		readerEPubKeyIndex: 0,
		ePubKey:            ePubKey1,
	}
	expectedRekeyInfos := []expectedRekeyInfoV3{expectedRekeyInfo1}

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do update to check idempotency.

	tlfCryptKeys := []kbfscrypto.TLFCryptKey{tlfCryptKey}

	serverHalves1b, err := rmd.UpdateKeyBundles(crypto,
		extra, updatedWriterKeys, updatedReaderKeys,
		ePubKey1, ePrivKey1, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves1b))

	expectedRekeyInfo1b := expectedRekeyInfoV3{
		serverHalves: serverHalves1b[0],
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo1b)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Rekey.

	privKey1b := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1b")
	updatedWriterKeys[uid1][privKey1b.GetPublicKey()] = true

	privKey3b := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3b")
	updatedReaderKeys[uid3][privKey3b.GetPublicKey()] = true

	ePubKey2, ePrivKey2, err := crypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	serverHalves2, err := rmd.UpdateKeyBundles(crypto,
		extra, updatedWriterKeys, updatedReaderKeys,
		ePubKey2, ePrivKey2, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves2))

	expectedRekeyInfo2 := expectedRekeyInfoV3{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1b: true},
		},
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3b: true},
		},
		serverHalves:       serverHalves2[0],
		writerEPubKeyIndex: 1,
		readerEPubKeyIndex: 1,
		ePubKey:            ePubKey2,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo2)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves2b, err := rmd.UpdateKeyBundles(crypto,
		extra, updatedWriterKeys, updatedReaderKeys,
		ePubKey2, ePrivKey2, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves2b))

	expectedRekeyInfo2b := expectedRekeyInfoV3{
		serverHalves: serverHalves2b[0],
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo2b)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Rekey writers only.

	privKey1c := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key1c")
	updatedWriterKeys[uid1][privKey1c.GetPublicKey()] = true

	ePubKey3, ePrivKey3, err := crypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	serverHalves3, err := rmd.UpdateKeyBundles(crypto,
		extra, updatedWriterKeys, updatedReaderKeys,
		ePubKey3, ePrivKey3, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves3))

	expectedRekeyInfo3 := expectedRekeyInfoV3{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {privKey1c: true},
		},
		readerPrivKeys:     nil,
		serverHalves:       serverHalves3[0],
		writerEPubKeyIndex: 2,
		readerEPubKeyIndex: -1,
		ePubKey:            ePubKey3,
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo3)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves3b, err := rmd.UpdateKeyBundles(crypto,
		extra, updatedWriterKeys, updatedReaderKeys,
		ePubKey3, ePrivKey3, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves3b))

	expectedRekeyInfo3b := expectedRekeyInfoV3{
		serverHalves: serverHalves3b[0],
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo3b)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Reader rekey.

	privKey3c := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3c")
	privKey3d := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("key3d")
	updatedReaderKeys[uid3][privKey3c.GetPublicKey()] = true
	updatedReaderKeys[uid3][privKey3d.GetPublicKey()] = true

	ePubKey4, ePrivKey4, err := crypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	filteredReaderKeys := UserDevicePublicKeys{
		uid3: updatedReaderKeys[uid3],
	}
	serverHalves4, err := rmd.UpdateKeyBundles(crypto,
		extra, nil, filteredReaderKeys,
		ePubKey4, ePrivKey4, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves4))

	expectedRekeyInfo4 := expectedRekeyInfoV3{
		writerPrivKeys: nil,
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {privKey3c: true, privKey3d: true},
		},
		serverHalves:       serverHalves4[0],
		writerEPubKeyIndex: -1,
		readerEPubKeyIndex: 2,
		ePubKey:            ePubKey4,
	}
	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo4)
	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)

	// Do again to check idempotency.

	serverHalves4b, err := rmd.UpdateKeyBundles(crypto,
		extra, nil, filteredReaderKeys,
		ePubKey4, ePrivKey4, tlfCryptKeys)
	require.NoError(t, err)
	require.Equal(t, 1, len(serverHalves4b))

	expectedRekeyInfo4b := expectedRekeyInfoV3{
		serverHalves: serverHalves4b[0],
	}

	expectedRekeyInfos = append(expectedRekeyInfos, expectedRekeyInfo4b)

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)
}

// TestBareRootMetadataV3AddKeyGenerationKeylessUsers checks that
// keyless users are handled properly by AddKeyGeneration.
func TestBareRootMetadataV3AddKeyGenerationKeylessUsers(t *testing.T) {
	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	uid3 := keybase1.MakeTestUID(3)

	updatedWriterKeys := UserDevicePublicKeys{
		uid1: {},
		uid2: {},
	}

	updatedReaderKeys := UserDevicePublicKeys{
		uid3: {},
	}

	tlfID := tlf.FakeID(1, tlf.Private)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid1.AsUserOrTeam(), uid2.AsUserOrTeam()},
		[]keybase1.UserOrTeamID{uid3.AsUserOrTeam()},
		[]keybase1.SocialAssertion{{}},
		nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)

	ePubKey1, ePrivKey1, err := crypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	// Add first key generation.

	fakeKeyData := [32]byte{1}
	pubKey := kbfscrypto.MakeTLFPublicKey(fakeKeyData)
	tlfCryptKey := kbfscrypto.MakeTLFCryptKey(fakeKeyData)

	extra, serverHalves1, err := rmd.AddKeyGeneration(codec,
		crypto, nil, updatedWriterKeys, updatedReaderKeys,
		ePubKey1, ePrivKey1,
		pubKey, kbfscrypto.TLFCryptKey{}, tlfCryptKey)
	require.NoError(t, err)

	wkb, rkb, err := rmd.getTLFKeyBundles(extra)
	require.NoError(t, err)

	expectedRekeyInfo1 := expectedRekeyInfoV3{
		writerPrivKeys: userDevicePrivateKeys{
			uid1: {},
			uid2: {},
		},
		readerPrivKeys: userDevicePrivateKeys{
			uid3: {},
		},
		serverHalves: serverHalves1,
	}
	expectedRekeyInfos := []expectedRekeyInfoV3{expectedRekeyInfo1}

	checkKeyBundlesV3(t, expectedRekeyInfos, tlfCryptKey, pubKey, wkb, rkb)
}
