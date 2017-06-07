// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestSignupEnginePerUserKey(t *testing.T) {
	subTestSignupEngine(t, true)
}

func TestPerUserKeySignupAndPullKeys(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.UpgradePerUserKey = true

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	kr, err := libkb.NewPerUserKeyring(tc.G, fu.UID())
	require.NoError(t, err)
	err = kr.Sync(context.Background())
	require.NoError(t, err)
	gen := keybase1.PerUserKeyGeneration(1)
	require.Equal(t, kr.CurrentGeneration(), gen)

	sigKey, err := kr.GetLatestSigningKey(context.TODO())
	require.NoError(t, err)
	require.NotNil(t, sigKey)
	require.NotNil(t, sigKey.Private)

	encKey, err := kr.GetEncryptionKeyByGeneration(context.TODO(), keybase1.PerUserKeyGeneration(1))
	require.NoError(t, err)
	require.NotNil(t, encKey)
	require.NotNil(t, encKey.Private)

	encKey, err = kr.GetEncryptionKeyBySeqno(context.TODO(), keybase1.Seqno(3))
	require.NoError(t, err)
	require.NotNil(t, encKey)
	require.NotNil(t, encKey.Private)

	_, err = kr.GetEncryptionKeyByGeneration(context.TODO(), keybase1.PerUserKeyGeneration(2))
	require.Error(t, err)

	err = kr.Sync(context.Background())
	require.Nil(t, err)
	require.Equal(t, kr.CurrentGeneration(), gen)
}

func TestPerUserKeySignupPlusPaper(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.UpgradePerUserKey = true

	fu := CreateAndSignupFakeUserPaper(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	kr, err := libkb.NewPerUserKeyring(tc.G, fu.UID())
	require.NoError(t, err)
	err = kr.Sync(context.Background())
	require.NoError(t, err)

	gen := keybase1.PerUserKeyGeneration(1)
	require.Equal(t, kr.CurrentGeneration(), gen)

	sigKey, err := kr.GetLatestSigningKey(context.TODO())
	require.NoError(t, err)
	require.NotNil(t, sigKey)
	require.NotNil(t, sigKey.Private)

	encKey, err := kr.GetEncryptionKeyByGeneration(context.TODO(), keybase1.PerUserKeyGeneration(1))
	require.NoError(t, err)
	require.NotNil(t, encKey)
	require.NotNil(t, encKey.Private)

	encKey, err = kr.GetEncryptionKeyBySeqno(context.TODO(), keybase1.Seqno(3))
	require.NoError(t, err)
	require.NotNil(t, encKey)
	require.NotNil(t, encKey.Private)

	_, err = kr.GetEncryptionKeyByGeneration(context.TODO(), keybase1.PerUserKeyGeneration(2))
	require.Error(t, err)

	err = kr.Sync(context.Background())
	require.Nil(t, err)
	require.Equal(t, kr.CurrentGeneration(), gen)
}
