// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	require "github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestSignupEngineSharedDH(t *testing.T) {
	subTestSignupEngine(t, true)
}

func TestSharedDHSignupAndPullKeys(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.EnableSharedDH = true

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	kr, err := libkb.NewSharedDHKeyring(tc.G, fu.UID(), tc.G.Env.GetDeviceID())
	require.NoError(t, err)
	err = kr.Sync(context.Background())
	require.NoError(t, err)
	gen := keybase1.SharedDHKeyGeneration(1)
	require.Equal(t, kr.CurrentGeneration(), gen)
	key := kr.SharedDHKey(context.TODO(), gen)
	require.NotNil(t, key)
	require.NotNil(t, key.Private)
	key2 := kr.SharedDHKey(context.TODO(), keybase1.SharedDHKeyGeneration(2))
	require.Nil(t, key2)

	kr2, err := kr.Update(context.Background())
	require.Nil(t, err)
	require.Equal(t, kr2.CurrentGeneration(), gen)

}

func TestSharedDHSignupPlusPaper(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.EnableSharedDH = true

	fu := CreateAndSignupFakeUserPaper(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	kr, err := libkb.NewSharedDHKeyring(tc.G, fu.UID(), tc.G.Env.GetDeviceID())
	require.NoError(t, err)
	err = kr.Sync(context.Background())
	require.NoError(t, err)
	gen := keybase1.SharedDHKeyGeneration(1)
	require.Equal(t, kr.CurrentGeneration(), gen)
	key := kr.SharedDHKey(context.TODO(), gen)
	require.NotNil(t, key)
	require.NotNil(t, key.Private)
	key2 := kr.SharedDHKey(context.TODO(), keybase1.SharedDHKeyGeneration(2))
	require.Nil(t, key2)

	kr2, err := kr.Update(context.Background())
	require.Nil(t, err)
	require.Equal(t, kr2.CurrentGeneration(), gen)

}
