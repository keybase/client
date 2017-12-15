// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
)

// Make sure creating an WKB ID for a WKB with no keys fails.
func TestWKBID(t *testing.T) {
	codec := kbfscodec.NewMsgpack()

	var wkb TLFWriterKeyBundleV3

	_, err := MakeTLFWriterKeyBundleID(codec, wkb)
	require.Error(t, err)

	wkb.Keys = UserDeviceKeyInfoMapV3{
		keybase1.UID(0): nil,
	}

	_, err = MakeTLFWriterKeyBundleID(codec, wkb)
	require.NoError(t, err)
}

// Make sure that RKBs can be created with nil vs. empty keys get the
// same ID.
func TestRKBID(t *testing.T) {
	codec := kbfscodec.NewMsgpack()

	var wkb1, wkb2 TLFReaderKeyBundleV3
	wkb2.Keys = make(UserDeviceKeyInfoMapV3)

	id1, err := MakeTLFReaderKeyBundleID(codec, wkb1)
	require.NoError(t, err)

	id2, err := MakeTLFReaderKeyBundleID(codec, wkb2)
	require.NoError(t, err)

	require.Equal(t, id1, id2)
}

// TestRemoveDevicesNotInV3 checks basic functionality of
// removeDevicesNotIn().
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

	udkimV3 := UserDeviceKeyInfoMapV3{
		uid1: DeviceKeyInfoMapV3{
			key1a: TLFCryptKeyInfo{
				ServerHalfID: id1a,
				EPubKeyIndex: 1,
			},
			key1b: TLFCryptKeyInfo{
				ServerHalfID: id1b,
				EPubKeyIndex: 2,
			},
		},
		uid2: DeviceKeyInfoMapV3{
			key2a: TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: 2,
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
				EPubKeyIndex: 2,
			},
		},
	}

	removalInfo := udkimV3.RemoveDevicesNotIn(UserDevicePublicKeys{
		uid2: {key2a: true, key2c: true},
		uid3: {key3a: true},
	})

	require.Equal(t, UserDeviceKeyInfoMapV3{
		uid2: DeviceKeyInfoMapV3{
			key2a: TLFCryptKeyInfo{
				ServerHalfID: id2a,
				EPubKeyIndex: 2,
			},
			key2c: TLFCryptKeyInfo{
				ServerHalfID: id2c,
				EPubKeyIndex: 0,
			},
		},
		uid3: DeviceKeyInfoMapV3{
			key3a: TLFCryptKeyInfo{
				ServerHalfID: id3a,
				EPubKeyIndex: 2,
			},
		},
	}, udkimV3)

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

// TestRemoveLastDeviceV3 checks behavior of removeDevicesNotIn() with
// respect to removing the last device of a user vs. removing the user
// completely.
//
// This is a regression test for KBFS-1898.
func TestRemoveLastDeviceV3(t *testing.T) {
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

	udkimV3 := UserDeviceKeyInfoMapV3{
		uid1: DeviceKeyInfoMapV3{
			key1: TLFCryptKeyInfo{
				ServerHalfID: id1,
				EPubKeyIndex: 1,
			},
		},
		uid2: DeviceKeyInfoMapV3{
			key2: TLFCryptKeyInfo{
				ServerHalfID: id2,
				EPubKeyIndex: 2,
			},
		},
		uid3: DeviceKeyInfoMapV3{},
		uid4: DeviceKeyInfoMapV3{},
	}

	removalInfo := udkimV3.RemoveDevicesNotIn(UserDevicePublicKeys{
		uid1: {},
		uid3: {},
	})

	require.Equal(t, UserDeviceKeyInfoMapV3{
		uid1: DeviceKeyInfoMapV3{},
		uid3: DeviceKeyInfoMapV3{},
	}, udkimV3)

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
		kbfscrypto.EncryptedTLFCryptKeys{},
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
