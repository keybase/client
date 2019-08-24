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
)

func TestAccountDelete(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "acct")

	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewAccountDelete(tc.G)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	_, res, err := tc.G.Resolver.ResolveUser(m, fu.Username)
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

	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase + "xxx"},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewAccountDelete(tc.G)
	err := RunEngine2(m, eng)
	require.Error(t, err)

	_, res, err := tc.G.Resolver.ResolveUser(m, fu.Username)
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
	t.Logf("created user %v %v", u.GetNormalizedName(), u.GetUID())

	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewAccountDelete(tc.G)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	t.Logf("deleted user")

	// Punch through the UPAK cache. Not dealing with upak vs delete race right now.
	tc.G.GetUPAKLoader().LoadV2(
		libkb.NewLoadUserArgWithMetaContext(libkb.NewMetaContextForTest(tc)).WithPublicKeyOptional().
			WithUID(u.GetUID()).WithForcePoll(true))

	i := newIdentify2WithUIDTester(tc.G)
	tc.G.SetProofServices(i)
	arg := &keybase1.Identify2Arg{
		Uid:              u.GetUID(),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
	ieng := NewIdentify2WithUID(tc.G, arg)
	uis = libkb.UIs{IdentifyUI: i}
	m = NewMetaContextForTest(tc).WithUIs(uis)
	t.Logf("identifying...")
	err = RunEngine2(m, ieng)
	require.Error(t, err)

	if _, ok := err.(libkb.UserDeletedError); !ok {
		t.Errorf("identify2 error: %T, expected libkb.UserDeletedError", err)
	}
}

func TestAccountDeleteAfterRestart(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := SignupFakeUserStoreSecret(tc, "acct")

	simulateServiceRestart(t, tc, fu)
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{Passphrase: fu.Passphrase},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewAccountDelete(tc.G)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	_, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	if err == nil {
		t.Fatal("no error loading deleted user")
	}
	if _, ok := err.(libkb.UserDeletedError); !ok {
		t.Errorf("loading deleted user error type: %T, expected libkb.DeletedError", err)
	}
}
