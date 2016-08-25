// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production
//
// This is a test template for the AccountDelete engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
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
	if _, ok := err.(libkb.NotFoundError); !ok {
		t.Errorf("loading deleted user error type: %T, expected libkb.NotFoundError", err)
	}
}
