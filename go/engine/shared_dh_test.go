// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	libkb "github.com/keybase/client/go/libkb"
	require "github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
	"testing"
)

func TestSignupEngineSDH(t *testing.T) {
	subTestSignupEngine(t, true)
}

func TestSDHSignupAndPullKeys(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	tc.Tp.EnableSharedDH = true

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	kr := libkb.NewSharedDHKeyring(tc.G, fu.UID())
	if kr == nil {
		t.Fatal("got null shared DH keyring")
	}
	err = kr.Sync(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	gen := libkb.SharedDHKeyGeneration(1)
	require.Equal(t, kr.CurrentGeneration(), gen)
	key := kr.SharedDHKey(gen)
	require.NotNil(t, key)
	require.NotNil(t, key.Private)
	key2 := kr.SharedDHKey(libkb.SharedDHKeyGeneration(2))
	require.Nil(t, key2)

	kr2, err := kr.Update(context.Background())
	require.Nil(t, err)
	require.Equal(t, kr2.CurrentGeneration(), gen)

}
