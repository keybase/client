// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production
//
// This is a test template for the AccountDelete engine.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"testing"
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

	_, res, err := tc.G.Resolver.ResolveUser(context.TODO(), fu.Username)
	if err != nil {
		t.Fatalf("got an error, but didn't expect one: %v", err)
	}
	err = res.GetError()
	if err != nil {
		t.Fatal("Did not expect a result back from the resolver")
	}
	if !res.GetDeleted() {
		t.Fatal("expected to get a deleted user")
	}
	tmp := res.FailOnDeleted()
	err = tmp.GetError()
	if err == nil {
		t.Fatal("expected a failure on deletion")
	}
	if _, ok := err.(libkb.DeletedError); !ok {
		t.Fatal("expected a libkb.DeletedError")
	}

	_, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, fu.Username))
	if err == nil {
		t.Fatal("no error loading deleted user")
	}
	if _, ok := err.(libkb.DeletedError); !ok {
		t.Errorf("loading deleted user error type: %T, expected libkb.DeletedError", err)
	}
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
		Uid:              u.GetUID(),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
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
