// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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

	ctx := &Context{}
	eng := NewAccountDelete(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	_, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	if err == nil {
		t.Fatal("no error loading deleted user")
	}
	if _, ok := err.(libkb.DeletedError); !ok {
		t.Errorf("loading deleted user error type: %T, expected libkb.DeletedError", err)
	}
}

func TestAccountDeleteAfterRestart(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := SignupFakeUserStoreSecret(tc, "acct")

	simulateServiceRestart(t, tc, fu)

	ctx := &Context{}
	eng := NewAccountDelete(tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatalf("AccountDelete after restart was broken but it looks like you've fixed it. Please make this test expect nil error here and uncomment the rest.")
	}
	require.Equal(t, "LoginSession is nil", err.Error())

	// _, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	// if err == nil {
	// 	t.Fatal("no error loading deleted user")
	// }
	// if _, ok := err.(libkb.DeletedError); !ok {
	// 	t.Errorf("loading deleted user error type: %T, expected libkb.DeletedError", err)
	// }
}

func TestAccountDeleteIdentify(t *testing.T) {
	tc := SetupEngineTest(t, "acct")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "acct")
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	if err != nil {
		t.Fatal(err)
	}

	ctx := &Context{}
	eng := NewAccountDelete(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid: u.GetUID(),
	}
	ieng := NewIdentify2WithUID(tc.G, arg)
	ictx := &Context{IdentifyUI: i}

	err = RunEngine(ieng, ictx)
	if err == nil {
		t.Fatal("identify2 ran successfully on deleted user")
	}
	if _, ok := err.(libkb.DeletedError); !ok {
		t.Errorf("identify2 error: %T, expected libkb.DeletedError", err)
	}
}
