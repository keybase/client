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

func TestRootMetadataVersionV3(t *testing.T) {
	tlfID := tlf.FakeID(1, false)

	// All V3 objects should have SegregatedKeyBundlesVer.

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	rmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	require.Equal(t, SegregatedKeyBundlesVer, rmd.Version())
}

func TestIsValidRekeyRequestBasicV3(t *testing.T) {
	tlfID := tlf.FakeID(1, false)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack())

	brmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)
	extra := FakeInitialRekey(
		brmd, codec, crypto, bh, kbfscrypto.TLFPublicKey{})

	newBrmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)
	newExtra := FakeInitialRekey(
		newBrmd, codec, crypto, bh, kbfscrypto.TLFPublicKey{})

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

func TestRootMetadataPublicVersionV3(t *testing.T) {
	tlfID := tlf.FakeID(1, true)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, []keybase1.UID{keybase1.PublicUID}, nil, nil, nil)
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
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1.KID(), half1a)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid2, key2.KID(), half2a)
	require.NoError(t, err)
	id3a, err := crypto.GetTLFCryptKeyServerHalfID(uid3, key3.KID(), half3a)
	require.NoError(t, err)

	tlfID := tlf.FakeID(1, false)

	bh, err := tlf.MakeHandle(
		[]keybase1.UID{uid1, uid2}, []keybase1.UID{uid3}, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadataV3(tlfID, bh)
	require.NoError(t, err)

	extra := FakeInitialRekey(
		brmd, codec, crypto, bh, kbfscrypto.TLFPublicKey{})

	wkb, rkb, ok := getKeyBundlesV3(extra)
	require.True(t, ok)

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

	wKeys := map[keybase1.UID][]kbfscrypto.CryptPublicKey{
		uid1: {key1},
	}
	rKeys := map[keybase1.UID][]kbfscrypto.CryptPublicKey{
		uid3: {key3},
	}

	removalInfo, err := brmd.RevokeRemovedDevices(wKeys, rKeys, extra)
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
