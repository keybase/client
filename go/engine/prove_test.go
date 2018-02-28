// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestProveRooter(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testProveRooter(t, sigVersion)
	})
}

func _testProveRooter(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")

	proveUI, _, err := proveRooter(tc.G, fu, sigVersion)
	if err != nil {
		t.Fatal(err)
	}

	if proveUI.overwrite {
		t.Error("unexpected prompt for overwrite in test")
	}
	if proveUI.warning {
		t.Error("got unexpected warning in test")
	}
	if proveUI.recheck {
		t.Error("unexpected recheck")
	}
	if !proveUI.checked {
		t.Error("OkToCheck never called")
	}
}

// Make sure the prove engine uses the secret store.
func TestProveRooterWithSecretStore(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testProveRooterWithSecretStore(t, sigVersion)
	})
}

func _testProveRooterWithSecretStore(t *testing.T, sigVersion libkb.SigVersion) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		_, _, err := proveRooterWithSecretUI(tc.G, fu, secretUI, sigVersion)
		if err != nil {
			t.Fatal(err)
		}
	})
}

// When device keys are cached, proofs shouldn't require passphrase prompt.
func TestProveRooterCachedKeys(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testProveRooterCachedKeys(t, sigVersion)
	})
}

func _testProveRooterCachedKeys(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")
	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	_, _, err := proveRooterWithSecretUI(tc.G, fu, &libkb.TestSecretUI{}, sigVersion)
	if err != nil {
		t.Fatal(err)
	}
}
