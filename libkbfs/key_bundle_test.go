// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/stretchr/testify/require"
)

type tlfCryptKeyInfoFuture struct {
	TLFCryptKeyInfo
	kbfscodec.Extra
}

func (cki tlfCryptKeyInfoFuture) toCurrent() TLFCryptKeyInfo {
	return cki.TLFCryptKeyInfo
}

func (cki tlfCryptKeyInfoFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return cki.toCurrent()
}

func makeFakeTLFCryptKeyInfoFuture(t *testing.T) tlfCryptKeyInfoFuture {
	hmac, err := kbfshash.DefaultHMAC(
		[]byte("fake key"), []byte("fake buf"))
	require.NoError(t, err)
	cki := TLFCryptKeyInfo{
		EncryptedTLFCryptKeyClientHalf{
			encryptedData{
				EncryptionSecretbox,
				[]byte("fake encrypted data"),
				[]byte("fake nonce"),
			},
		},
		TLFCryptKeyServerHalfID{hmac},
		5,
		codec.UnknownFieldSetHandler{},
	}
	return tlfCryptKeyInfoFuture{
		cki,
		kbfscodec.MakeExtraOrBust("TLFCryptKeyInfo", t),
	}
}

func TestTLFCryptKeyInfoUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeTLFCryptKeyInfoFuture(t))
}

func TestUserServerHalfRemovalInfoAddGeneration(t *testing.T) {
	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")
	key3 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key3")
	key4 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key4")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half1b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})
	half1c := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x4})
	half2b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x5})
	half2c := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x6})

	uid := keybase1.MakeTestUID(0x1)
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid, key1, half1a)
	require.NoError(t, err)
	id1b, err := crypto.GetTLFCryptKeyServerHalfID(uid, key1, half1b)
	require.NoError(t, err)
	id1c, err := crypto.GetTLFCryptKeyServerHalfID(uid, key1, half1c)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid, key2, half2a)
	require.NoError(t, err)
	id2b, err := crypto.GetTLFCryptKeyServerHalfID(uid, key2, half2b)
	require.NoError(t, err)
	id2c, err := crypto.GetTLFCryptKeyServerHalfID(uid, key2, half2c)
	require.NoError(t, err)

	// Required because addGeneration may modify its object even
	// if it returns an error.
	makeInfo := func(good bool) userServerHalfRemovalInfo {
		var key2IDs []TLFCryptKeyServerHalfID
		if good {
			key2IDs = []TLFCryptKeyServerHalfID{id2a, id2b}
		} else {
			key2IDs = []TLFCryptKeyServerHalfID{id2a}
		}
		return userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1: {id1a, id1b},
				key2: key2IDs,
			},
		}
	}

	genInfo := userServerHalfRemovalInfo{
		userRemoved: false,
	}

	err = makeInfo(true).addGeneration(uid, genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "userRemoved=true"),
		"err=%v", err)

	genInfo.userRemoved = true
	err = makeInfo(true).addGeneration(uid, genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "device count=2"),
		"err=%v", err)

	genInfo.deviceServerHalfIDs = deviceServerHalfRemovalInfo{
		key1: {id1c},
		key2: {id2c},
	}
	err = makeInfo(false).addGeneration(uid, genInfo)
	require.Error(t, err)
	require.True(t,
		// Required because of go's random iteration order.
		strings.HasPrefix(err.Error(), "expected 2 keys") ||
			strings.HasPrefix(err.Error(), "expected 1 keys"),
		"err=%v", err)

	genInfo.deviceServerHalfIDs = deviceServerHalfRemovalInfo{
		key1: {},
		key2: {},
	}
	err = makeInfo(true).addGeneration(uid, genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(),
		"expected exactly one key"), "err=%v", err)

	genInfo.deviceServerHalfIDs = deviceServerHalfRemovalInfo{
		key3: {id1c},
		key4: {id2c},
	}
	err = makeInfo(true).addGeneration(uid, genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(),
		"no generation info"), "err=%v", err)

	genInfo.deviceServerHalfIDs = deviceServerHalfRemovalInfo{
		key1: {id1c},
		key2: {id2c},
	}
	info := makeInfo(true)
	err = info.addGeneration(uid, genInfo)
	require.NoError(t, err)
	require.Equal(t, userServerHalfRemovalInfo{
		userRemoved: true,
		deviceServerHalfIDs: deviceServerHalfRemovalInfo{
			key1: {id1a, id1b, id1c},
			key2: {id2a, id2b, id2c},
		},
	}, info)
}

func TestServerHalfRemovalInfoAddGeneration(t *testing.T) {
	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half1b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})
	half1c := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x4})
	half2b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x5})
	half2c := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x6})

	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1a)
	require.NoError(t, err)
	id1b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1b)
	require.NoError(t, err)
	id1c, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1c)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key2, half2a)
	require.NoError(t, err)
	id2b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key2, half2b)
	require.NoError(t, err)
	id2c, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key2, half2c)
	require.NoError(t, err)

	// Required because addGeneration may modify its object even
	// if it returns an error.
	makeInfo := func() ServerHalfRemovalInfo {
		return ServerHalfRemovalInfo{
			uid1: userServerHalfRemovalInfo{
				userRemoved: true,
				deviceServerHalfIDs: deviceServerHalfRemovalInfo{
					key1: {id1a, id1b},
					key2: {id2a, id2b},
				},
			},
			uid2: userServerHalfRemovalInfo{
				userRemoved: false,
				deviceServerHalfIDs: deviceServerHalfRemovalInfo{
					key1: {id1a, id1c},
					key2: {id2a, id2c},
				},
			},
		}
	}

	genInfo := ServerHalfRemovalInfo{
		uid1: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1: {id1c},
				key2: {id2c},
			},
		},
	}

	err = makeInfo().addGeneration(genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "user count=2"),
		"err=%v", err)

	genInfo[uid3] = userServerHalfRemovalInfo{
		userRemoved: false,
		deviceServerHalfIDs: deviceServerHalfRemovalInfo{
			key1: {id1b},
			key2: {id2b},
		},
	}

	err = makeInfo().addGeneration(genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "no generation info"),
		"err=%v", err)

	genInfo[uid2] = userServerHalfRemovalInfo{
		userRemoved: true,
		deviceServerHalfIDs: deviceServerHalfRemovalInfo{
			key1: {id1b},
			key2: {id2b},
		},
	}
	delete(genInfo, uid3)

	err = makeInfo().addGeneration(genInfo)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "userRemoved=false"),
		"err=%v", err)

	genInfo[uid2] = userServerHalfRemovalInfo{
		userRemoved: false,
		deviceServerHalfIDs: deviceServerHalfRemovalInfo{
			key1: {id1b},
			key2: {id2b},
		},
	}
	info := makeInfo()
	err = info.addGeneration(genInfo)
	require.NoError(t, err)
	require.Equal(t, ServerHalfRemovalInfo{
		uid1: userServerHalfRemovalInfo{
			userRemoved: true,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1: {id1a, id1b, id1c},
				key2: {id2a, id2b, id2c},
			},
		},
		uid2: userServerHalfRemovalInfo{
			userRemoved: false,
			deviceServerHalfIDs: deviceServerHalfRemovalInfo{
				key1: {id1a, id1c, id1b},
				key2: {id2a, id2c, id2b},
			},
		},
	}, info)
}

func TestServerHalfRemovalInfoMergeUsers(t *testing.T) {
	key1 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key1")
	key2 := kbfscrypto.MakeFakeCryptPublicKeyOrBust("key2")

	half1a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x1})
	half1b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x2})
	half2a := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x3})
	half2b := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{0x4})

	uid1 := keybase1.MakeTestUID(0x1)
	uid2 := keybase1.MakeTestUID(0x2)
	uid3 := keybase1.MakeTestUID(0x3)
	uid4 := keybase1.MakeTestUID(0x4)

	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	id1a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1a)
	require.NoError(t, err)
	id1b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key1, half1b)
	require.NoError(t, err)
	id2a, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key2, half2a)
	require.NoError(t, err)
	id2b, err := crypto.GetTLFCryptKeyServerHalfID(uid1, key2, half2b)
	require.NoError(t, err)

	userRemovalInfo := userServerHalfRemovalInfo{
		userRemoved: true,
		deviceServerHalfIDs: deviceServerHalfRemovalInfo{
			key1: {id1a, id1b},
			key2: {id2a, id2b},
		},
	}

	info1 := ServerHalfRemovalInfo{
		uid1: userRemovalInfo,
		uid2: userRemovalInfo,
	}

	info2 := ServerHalfRemovalInfo{
		uid1: userRemovalInfo,
		uid3: userRemovalInfo,
	}

	_, err = info1.mergeUsers(info2)
	require.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(),
		fmt.Sprintf("user %s is in both", uid1)),
		"err=%v", err)

	info2 = ServerHalfRemovalInfo{
		uid3: userRemovalInfo,
		uid4: userRemovalInfo,
	}

	info3, err := info1.mergeUsers(info2)
	require.NoError(t, err)
	require.Equal(t, ServerHalfRemovalInfo{
		uid1: userRemovalInfo,
		uid2: userRemovalInfo,
		uid3: userRemovalInfo,
		uid4: userRemovalInfo,
	}, info3)
}
