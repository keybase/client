// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production
//
// This is a test template for the AccountDelete engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestAccountDelete(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "acct")

	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase},
	}
	eng := NewAccountDelete(tc.G)
	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	_, res, err := tc.G.Resolver.ResolveUser(context.TODO(), fu.Username)
	require.NoError(t, err)

	err = res.GetError()
	require.NoError(t, err)
	require.True(t, res.GetDeleted())

	tmp := res.FailOnDeleted()
	err = tmp.GetError()
	require.Error(t, err)

	if _, ok := err.(libkb.UserDeletedError); !ok {
		t.Fatal("expected a libkb.UserDeletedError")
	}

	_, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	require.Error(t, err)

	if _, ok := err.(libkb.UserDeletedError); !ok {
		t.Errorf("loading deleted user error type: %T, expected libkb.UserDeletedError", err)
	}
}

func TestAccountDeleteBadPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "acct")

	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase + "xxx"},
	}
	eng := NewAccountDelete(tc.G)
	err := RunEngine(eng, ctx)
	require.Error(t, err)

	_, res, err := tc.G.Resolver.ResolveUser(context.TODO(), fu.Username)
	require.NoError(t, err)
	err = res.GetError()
	require.NoError(t, err)
	require.False(t, res.GetDeleted())

	tmp := res.FailOnDeleted()
	err = tmp.GetError()
	require.NoError(t, err)
}

func TestAccountDeleteIdentify(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "acct")
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	require.NoError(t, err)

	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase},
	}
	eng := NewAccountDelete(tc.G)
	err = RunEngine(eng, ctx)
	require.NoError(t, err)

	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:              u.GetUID(),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
	ieng := NewIdentify2WithUID(tc.G, arg)
	ictx := &Context{IdentifyUI: i}

	err = RunEngine(ieng, ictx)
	require.Error(t, err)

	if _, ok := err.(libkb.UserDeletedError); !ok {
		t.Errorf("identify2 error: %T, expected libkb.UserDeletedError", err)
	}
}
