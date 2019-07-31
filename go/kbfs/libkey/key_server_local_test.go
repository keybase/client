// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkey

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbfs/idutil"
	idutiltest "github.com/keybase/client/go/kbfs/idutil/test"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

type testConfig struct {
	codec     kbfscodec.Codec
	kbpki     idutil.KBPKI
	keyServer KeyServer
}

func (tc testConfig) Codec() kbfscodec.Codec {
	return tc.codec
}

func (tc testConfig) KBPKI() idutil.KBPKI {
	return tc.kbpki
}

func (tc testConfig) KeyServer() KeyServer {
	return tc.keyServer
}

// Test that Put/Get works for TLF crypt key server halves.
func TestKeyServerLocalTLFCryptKeyServerHalves(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"

	ctx := context.Background()
	codec := kbfscodec.NewMsgpack()

	localUsers := idutil.MakeLocalUsers(
		[]kbname.NormalizedUsername{userName1, userName2})
	uid1 := localUsers[0].UID
	daemon1 := idutil.NewDaemonLocal(uid1, localUsers, nil, codec)
	kbpki1 := &idutiltest.DaemonKBPKI{
		KBPKI:  nil,
		Daemon: daemon1,
	}
	config1 := testConfig{codec, kbpki1, nil}
	ks1, err := NewKeyServerMemory(config1, logger.NewTestLogger(t))
	require.NoError(t, err)
	defer ks1.Shutdown()
	config1.keyServer = ks1
	ko1 := KeyOpsStandard{config1}

	session1, err := kbpki1.GetCurrentSession(ctx)
	require.NoError(t, err)
	publicKey1 := session1.CryptPublicKey

	uid2 := localUsers[1].UID
	daemon2 := idutil.NewDaemonLocal(uid2, localUsers, nil, codec)
	kbpki2 := &idutiltest.DaemonKBPKI{
		KBPKI:  nil,
		Daemon: daemon2,
	}
	config2 := testConfig{codec, kbpki2, nil}
	ks2 := ks1.CopyWithConfigAndLogger(config2, logger.NewTestLogger(t))
	defer ks2.Shutdown()
	config2.keyServer = ks2
	ko2 := KeyOpsStandard{config2}

	session2, err := kbpki2.GetCurrentSession(ctx)
	require.NoError(t, err)
	publicKey2 := session2.CryptPublicKey

	serverHalf1 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{1})
	serverHalf2 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{2})
	serverHalf3 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{3})
	serverHalf4 := kbfscrypto.MakeTLFCryptKeyServerHalf([32]byte{4})

	// write 1
	keyHalves := make(kbfsmd.UserDeviceKeyServerHalves)
	deviceHalves := make(kbfsmd.DeviceKeyServerHalves)
	deviceHalves[publicKey1] = serverHalf1
	keyHalves[uid1] = deviceHalves

	err = ko1.PutTLFCryptKeyServerHalves(ctx, keyHalves)
	require.NoError(t, err)

	// write 2
	keyHalves = make(kbfsmd.UserDeviceKeyServerHalves)
	deviceHalves = make(kbfsmd.DeviceKeyServerHalves)
	deviceHalves[publicKey1] = serverHalf2
	keyHalves[uid1] = deviceHalves

	err = ko1.PutTLFCryptKeyServerHalves(ctx, keyHalves)
	require.NoError(t, err)

	// write 3 and 4 together
	keyHalves = make(kbfsmd.UserDeviceKeyServerHalves)
	deviceHalves1 := make(kbfsmd.DeviceKeyServerHalves)
	deviceHalves2 := make(kbfsmd.DeviceKeyServerHalves)
	deviceHalves1[publicKey1] = serverHalf3
	keyHalves[uid1] = deviceHalves1
	deviceHalves2[publicKey2] = serverHalf4
	keyHalves[uid2] = deviceHalves2

	err = ko1.PutTLFCryptKeyServerHalves(ctx, keyHalves)
	require.NoError(t, err)

	serverHalfID1, err :=
		kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, publicKey1, serverHalf1)
	require.NoError(t, err)

	serverHalfID2, err :=
		kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, publicKey1, serverHalf2)
	require.NoError(t, err)

	serverHalfID3, err :=
		kbfscrypto.MakeTLFCryptKeyServerHalfID(uid1, publicKey1, serverHalf3)
	require.NoError(t, err)

	serverHalfID4, err :=
		kbfscrypto.MakeTLFCryptKeyServerHalfID(uid2, publicKey2, serverHalf4)
	require.NoError(t, err)

	half1, err := ko1.GetTLFCryptKeyServerHalf(ctx, serverHalfID1, publicKey1)
	require.NoError(t, err)

	require.Equal(t, serverHalf1, half1)

	half2, err := ko1.GetTLFCryptKeyServerHalf(ctx, serverHalfID2, publicKey1)
	require.NoError(t, err)

	require.Equal(t, serverHalf2, half2)

	half3, err := ko1.GetTLFCryptKeyServerHalf(ctx, serverHalfID3, publicKey1)
	require.NoError(t, err)

	require.Equal(t, serverHalf3, half3)

	_, err = ko1.GetTLFCryptKeyServerHalf(ctx, serverHalfID4, publicKey1)
	require.IsType(t, kbfsmd.ServerErrorUnauthorized{}, err)

	// try to get uid2's key now as uid2
	half4, err := ko2.GetTLFCryptKeyServerHalf(ctx, serverHalfID4, publicKey2)
	require.NoError(t, err)

	require.Equal(t, serverHalf4, half4)

	serverHalfIDNope, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(
		uid1, publicKey1, serverHalf4)
	require.NoError(t, err)

	_, err = ko1.GetTLFCryptKeyServerHalf(ctx, serverHalfIDNope, publicKey1)
	require.Error(t, err)
}
