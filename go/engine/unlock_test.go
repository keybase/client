// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func assertStreamCache(tc libkb.TestContext, valid bool) bool {
	var ppsValid bool
	tc.G.LoginState().Account(func(a *libkb.Account) {
		ppsValid = a.PassphraseStreamCache().Valid()
	}, "clear stream cache")

	return valid == ppsValid
}

func TestUnlock(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after sign up")
	}

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: fu.NewSecretUI(),
	}

	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	if !assertStreamCache(tc, false) {
		t.Fatal("expected invalid stream cache after clear")
	}

	eng := NewUnlock(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after unlock")
	}
}

func TestUnlockNoop(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after sign up")
	}

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: fu.NewSecretUI(),
	}

	eng := NewUnlock(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after unlock")
	}
}

func TestUnlockWithPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after sign up")
	}

	ctx := &Context{
		LogUI:   tc.G.UI.GetLogUI(),
		LoginUI: &libkb.TestLoginUI{},
		// No SecretUI here!
	}

	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	if !assertStreamCache(tc, false) {
		t.Fatal("expected invalid stream cache after clear")
	}

	eng := NewUnlockWithPassphrase(tc.G, fu.Passphrase)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	if !assertStreamCache(tc, true) {
		t.Fatal("expected valid stream cache after unlock")
	}
}
