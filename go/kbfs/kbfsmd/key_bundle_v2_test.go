// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"reflect"
	"strings"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
)

// TestRemoveDevicesNotInV2 checks basic functionality of
// removeDevicesNotIn().
func TestRemoveDevicesNotInV2(t *testing.T) {
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

	id1a, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, key1a, half1a)
	require.NoError(t, err)
	id1b, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, key1b, half1b)
	require.NoError(t, err)
	id2a, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, key2a, half2a)
	require.NoError(t, err)
	id2b, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, key2b, half2b)
	require.NoError(t, err)
	id2c, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, key2c, half2c)
	require.NoError(t, err)
	id3a, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, key3a, half3a)
	require.NoError(t, err)

	udkimV2 := UserDeviceKeyInfoMapV2{
		uid1: DeviceKeyInfoMapV2{
			key1a.KID(): TLFCryptKeyInfo{
				ServerHalfID: id1a,
				EPubKeyIndex: -1,
			},
			key1b.KID(): TLFCryptKeyInfo{
				ServerHalfID: id1b,
				EPubKeyIndex: +2,
			},
		},
		uid2: DeviceKeyInfoMapV2{
			key2a.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: -2,
			},
			key2b.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2b,
				EPubKeyIndex: 0,
			},
			key2c.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2c,
				EPubKeyIndex: 0,
			},
		},
		uid3: DeviceKeyInfoMapV2{
			key3a.KID(): TLFCryptKeyInfo{
				ServerHalfID: id3a,
				EPubKeyIndex: -2,
			},
		},
	}

	removalInfo := udkimV2.RemoveDevicesNotIn(UserDevicePublicKeys{
		uid2: {key2a: true, key2c: true},
		uid3: {key3a: true},
	})

	require.Equal(t, UserDeviceKeyInfoMapV2{
		uid2: DeviceKeyInfoMapV2{
			key2a.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: -2,
			},
			key2c.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2c,
				EPubKeyIndex: 0,
			},
		},
		uid3: DeviceKeyInfoMapV2{
			key3a.KID(): TLFCryptKeyInfo{
				ServerHalfID: id3a,
				EPubKeyIndex: -2,
			},
		},
	}, udkimV2)

	require.Equal(t, ServerHalfRemovalInfo{
		uid1: UserServerHalfRemovalInfo{
			UserRemoved: true,
			DeviceServerHalfIDs: DeviceServerHalfRemovalInfo{
				key1a: []kbfscrypto.TLFCryptKeyServerHalfID{id1a},
				key1b: []kbfscrypto.TLFCryptKeyServerHalfID{id1b},
			},
		},
		uid2: UserServerHalfRemovalInfo{
			UserRemoved: false,
			DeviceServerHalfIDs: DeviceServerHalfRemovalInfo{
				key2b: []kbfscrypto.TLFCryptKeyServerHalfID{id2b},
			},
		},
	}, removalInfo)
}

// TestRemoveLastDeviceV2 checks behavior of removeDevicesNotIn() with
// respect to removing the last device of a user vs. removing the user
// completely.
//
// This is a regression test for KBFS-1898.
func TestRemoveLastDeviceV2(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)
	uid4 := keybase1.MakeTestUID(0x4)

	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")

	half1 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half2 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})

	id1, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, key1, half1)
	require.NoError(t, err)
	id2, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, key2, half2)
	require.NoError(t, err)

	udkimV2 := UserDeviceKeyInfoMapV2{
		uid1: DeviceKeyInfoMapV2{
			key1.KID(): TLFCryptKeyInfo{
				ServerHalfID: id1,
				EPubKeyIndex: -1,
			},
		},
		uid2: DeviceKeyInfoMapV2{
			key2.KID(): TLFCryptKeyInfo{
				ServerHalfID: id2,
				EPubKeyIndex: -2,
			},
		},
		uid3: DeviceKeyInfoMapV2{},
		uid4: DeviceKeyInfoMapV2{},
	}

	removalInfo := udkimV2.RemoveDevicesNotIn(UserDevicePublicKeys{
		uid1: {},
		uid3: {},
	})

	require.Equal(t, UserDeviceKeyInfoMapV2{
		uid1: DeviceKeyInfoMapV2{},
		uid3: DeviceKeyInfoMapV2{},
	}, udkimV2)

	require.Equal(t, ServerHalfRemovalInfo{
		uid1: UserServerHalfRemovalInfo{
			UserRemoved: false,
			DeviceServerHalfIDs: DeviceServerHalfRemovalInfo{
				key1: []kbfscrypto.TLFCryptKeyServerHalfID{id1},
			},
		},
		uid2: UserServerHalfRemovalInfo{
			UserRemoved: true,
			DeviceServerHalfIDs: DeviceServerHalfRemovalInfo{
				key2: []kbfscrypto.TLFCryptKeyServerHalfID{id2},
			},
		},
		uid4: UserServerHalfRemovalInfo{
			UserRemoved:         true,
			DeviceServerHalfIDs: DeviceServerHalfRemovalInfo{},
		},
	}, removalInfo)
}

func TestToTLFWriterKeyBundleV3(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)

	key1a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key1b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key2a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")
	key2b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key4")
	key2c := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key5")

	wEPubKey1 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x1})
	wEPubKey2 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x2})

	tlfPublicKey := kbfscrypto.MakeTLFPublicKey([32]byte{0x1})

	wkbV2 := TLFWriterKeyBundleV2{
		WKeys: UserDeviceKeyInfoMapV2{
			uid1: DeviceKeyInfoMapV2{
				key1a.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key1b.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
			},
			uid2: DeviceKeyInfoMapV2{
				key2a.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
				key2b.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key2c.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
			},
		},
		TLFPublicKey: tlfPublicKey,
		TLFEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			wEPubKey1, wEPubKey2,
		},
	}

	wkg := TLFWriterKeyGenerationsV2{TLFWriterKeyBundleV2{}, wkbV2}

	codec := kbfscodec.NewMsgpack()
	tlfCryptKey1 := kbfscrypto.MakeTLFCryptKey([32]byte{0x1})
	tlfCryptKey2 := kbfscrypto.MakeTLFCryptKey([32]byte{0x2})
	tlfCryptKeyGetter := func() ([]kbfscrypto.TLFCryptKey, error) {
		return []kbfscrypto.TLFCryptKey{tlfCryptKey1, tlfCryptKey2}, nil
	}

	expectedWKBV3 := TLFWriterKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1a: TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key1b: TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
			},
			uid2: DeviceKeyInfoMapV3{
				key2a: TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
				key2b: TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key2c: TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
			},
		},
		TLFPublicKey: tlfPublicKey,
		TLFEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			wEPubKey1, wEPubKey2,
		},
	}

	retrievedWKBV2, wkbV3, err := wkg.ToTLFWriterKeyBundleV3(
		codec, tlfCryptKeyGetter)
	require.NoError(t, err)
	require.Equal(t, wkbV2, retrievedWKBV2)
	encryptedOldKeys := wkbV3.EncryptedHistoricTLFCryptKeys
	wkbV3.EncryptedHistoricTLFCryptKeys = kbfscrypto.EncryptedTLFCryptKeys{}
	require.Equal(t, expectedWKBV3, wkbV3)
	oldKeys, err :=
		kbfscrypto.DecryptTLFCryptKeys(codec, encryptedOldKeys, tlfCryptKey2)
	require.NoError(t, err)
	require.Equal(t, oldKeys, []kbfscrypto.TLFCryptKey{tlfCryptKey1})
}

func TestToTLFReaderKeyBundleV3(t *testing.T) {
	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)

	key1a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key1b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key2a := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")
	key2b := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key4")
	key2c := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key5")

	rEPubKey1 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x1})
	rEPubKey2 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x2})

	rkbV2 := TLFReaderKeyBundleV2{
		RKeys: UserDeviceKeyInfoMapV2{
			uid1: DeviceKeyInfoMapV2{
				key1a.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: -1,
				},
				key1b.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: +2,
				},
			},
			uid2: DeviceKeyInfoMapV2{
				key2a.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: -2,
				},
				key2b.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key2c.KID(): TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
			},
		},
		TLFReaderEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			rEPubKey1, rEPubKey2,
		},
	}

	rkg := TLFReaderKeyGenerationsV2{TLFReaderKeyBundleV2{}, rkbV2}

	codec := kbfscodec.NewMsgpack()
	_, err := rkg.ToTLFReaderKeyBundleV3(codec, TLFWriterKeyBundleV2{})
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "Invalid key in WriterEPubKeys with index "),
		"err: %v", err)

	wEPubKey1 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x3})
	wEPubKey2 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x4})
	wEPubKey3 := kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0x5})

	wkbV2 := TLFWriterKeyBundleV2{
		TLFEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			wEPubKey1, wEPubKey2, wEPubKey3,
		},
	}

	// We need two expectedRKBV3s since the result depends on map
	// iteration order.

	expectedRKBV3a := TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1a: TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key1b: TLFCryptKeyInfo{
					EPubKeyIndex: 2,
				},
			},
			uid2: DeviceKeyInfoMapV3{
				key2a: TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
				key2b: TLFCryptKeyInfo{
					EPubKeyIndex: 3,
				},
				key2c: TLFCryptKeyInfo{
					EPubKeyIndex: 3,
				},
			},
		},
		TLFEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			rEPubKey1, rEPubKey2, wEPubKey3, wEPubKey1,
		},
	}

	expectedRKBV3b := TLFReaderKeyBundleV3{
		Keys: UserDeviceKeyInfoMapV3{
			uid1: DeviceKeyInfoMapV3{
				key1a: TLFCryptKeyInfo{
					EPubKeyIndex: 0,
				},
				key1b: TLFCryptKeyInfo{
					EPubKeyIndex: 3,
				},
			},
			uid2: DeviceKeyInfoMapV3{
				key2a: TLFCryptKeyInfo{
					EPubKeyIndex: 1,
				},
				key2b: TLFCryptKeyInfo{
					EPubKeyIndex: 2,
				},
				key2c: TLFCryptKeyInfo{
					EPubKeyIndex: 2,
				},
			},
		},
		TLFEphemeralPublicKeys: kbfscrypto.TLFEphemeralPublicKeys{
			rEPubKey1, rEPubKey2, wEPubKey1, wEPubKey3,
		},
	}

	rkbV3, err := rkg.ToTLFReaderKeyBundleV3(codec, wkbV2)
	require.NoError(t, err)
	if !reflect.DeepEqual(expectedRKBV3a, rkbV3) {
		require.Equal(t, expectedRKBV3b, rkbV3)
	}
}

type deviceKeyInfoMapV2Future map[keybase1.KID]tlfCryptKeyInfoFuture

func (dkimf deviceKeyInfoMapV2Future) toCurrent() DeviceKeyInfoMapV2 {
	dkim := make(DeviceKeyInfoMapV2, len(dkimf))
	for k, kif := range dkimf {
		ki := kif.toCurrent()
		dkim[k] = TLFCryptKeyInfo(ki)
	}
	return dkim
}

type userDeviceKeyInfoMapV2Future map[keybase1.UID]deviceKeyInfoMapV2Future

func (udkimf userDeviceKeyInfoMapV2Future) toCurrent() UserDeviceKeyInfoMapV2 {
	udkim := make(UserDeviceKeyInfoMapV2)
	for u, dkimf := range udkimf {
		dkim := dkimf.toCurrent()
		udkim[u] = dkim
	}
	return udkim
}

type tlfWriterKeyBundleV2Future struct {
	TLFWriterKeyBundleV2
	// Override TLFWriterKeyBundleV2.WKeys.
	WKeys userDeviceKeyInfoMapV2Future
	kbfscodec.Extra
}

func (wkbf tlfWriterKeyBundleV2Future) toCurrent() TLFWriterKeyBundleV2 {
	wkb := wkbf.TLFWriterKeyBundleV2
	wkb.WKeys = wkbf.WKeys.toCurrent()
	return wkb
}

func (wkbf tlfWriterKeyBundleV2Future) ToCurrentStruct() kbfscodec.CurrentStruct {
	return wkbf.toCurrent()
}

func makeFakeDeviceKeyInfoMapV2Future(t *testing.T) userDeviceKeyInfoMapV2Future {
	return userDeviceKeyInfoMapV2Future{
		"fake uid": deviceKeyInfoMapV2Future{
			"fake kid": makeFakeTLFCryptKeyInfoFuture(t),
		},
	}
}

func makeFakeTLFWriterKeyBundleV2Future(
	t *testing.T) tlfWriterKeyBundleV2Future {
	wkb := TLFWriterKeyBundleV2{
		nil,
		kbfscrypto.MakeTLFPublicKey([32]byte{0xa}),
		kbfscrypto.TLFEphemeralPublicKeys{
			kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0xb}),
		},
		codec.UnknownFieldSetHandler{},
	}
	return tlfWriterKeyBundleV2Future{
		wkb,
		makeFakeDeviceKeyInfoMapV2Future(t),
		kbfscodec.MakeExtraOrBust("TLFWriterKeyBundleV2", t),
	}
}

func TestTLFWriterKeyBundleV2UnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFWriterKeyBundleV2Future(t))
}

type tlfReaderKeyBundleV2Future struct {
	TLFReaderKeyBundleV2
	// Override TLFReaderKeyBundleV2.RKeys.
	RKeys userDeviceKeyInfoMapV2Future
	kbfscodec.Extra
}

func (rkbf tlfReaderKeyBundleV2Future) toCurrent() TLFReaderKeyBundleV2 {
	rkb := rkbf.TLFReaderKeyBundleV2
	rkb.RKeys = rkbf.RKeys.toCurrent()
	return rkb
}

func (rkbf tlfReaderKeyBundleV2Future) ToCurrentStruct() kbfscodec.CurrentStruct {
	return rkbf.toCurrent()
}

func makeFakeTLFReaderKeyBundleV2Future(
	t *testing.T) tlfReaderKeyBundleV2Future {
	rkb := TLFReaderKeyBundleV2{
		nil,
		kbfscrypto.TLFEphemeralPublicKeys{
			kbfscrypto.MakeTLFEphemeralPublicKey([32]byte{0xc}),
		},
		codec.UnknownFieldSetHandler{},
	}
	return tlfReaderKeyBundleV2Future{
		rkb,
		makeFakeDeviceKeyInfoMapV2Future(t),
		kbfscodec.MakeExtraOrBust("TLFReaderKeyBundleV2", t),
	}
}

func TestTLFReaderKeyBundleV2UnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFReaderKeyBundleV2Future(t))
}
