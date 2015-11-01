// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func getCurrentBTCAddr(tc libkb.TestContext, username string) string {
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	if err != nil {
		tc.T.Fatal(err)
	}
	cryptoLink := u.IDTable().ActiveCryptocurrency()
	if cryptoLink == nil {
		return ""
	}
	return cryptoLink.ToDisplayString()
}

const (
	firstAddress  = "17JyYCvn37BodyLbZdKQrW3WNbW7JcsvAJ"
	secondAddress = "1kwg3FnLysQAi8Wqu37KqBwTUaUGiL7t1"
)

func TestBTC(t *testing.T) {
	tc := SetupEngineTest(t, "btc")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "btc")

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}

	// First test setting a bad address; this should fail.
	e := NewBTCEngine("somejunk", false /* force */, tc.G)
	err := RunEngine(e, ctx)
	if err == nil {
		t.Fatalf("Bad address should have failed.")
	}
	current := getCurrentBTCAddr(tc, u.Username)
	if current != "" {
		t.Fatalf("No address should be set")
	}

	// Now set a real address; this should succeed.
	e = NewBTCEngine(firstAddress, false /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentBTCAddr(tc, u.Username)
	if current != firstAddress {
		t.Fatalf("Expected btc address '%s'. Found '%s'.", firstAddress, current)
	}

	// Test overwriting it without --force; should fail.
	e = NewBTCEngine(secondAddress, false /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err == nil {
		t.Fatal("Overwriting a btc address should fail without --force.")
	} else if !strings.Contains(err.Error(), "--force") {
		t.Fatal("Error should mention the --force flag.")
	}
	current = getCurrentBTCAddr(tc, u.Username)
	if current != firstAddress {
		t.Fatalf("Address should not have changed.")
	}

	// Now test the overwrite with the --force flag; should succeed.
	e = NewBTCEngine(secondAddress, true /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentBTCAddr(tc, u.Username)
	if current != secondAddress {
		t.Fatalf("Expected btc address '%s'. Found '%s'.", secondAddress, current)
	}

	// Make sure the previous link was revoked.
	loadedUser, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	if err != nil {
		t.Fatalf("Failed to load user.")
	}
	revoked := loadedUser.IDTable().GetRevokedCryptocurrencyForTesting()
	if len(revoked) != 1 {
		t.Fatal("Expected 1 revoked link.")
	} else if revoked[0].ToDisplayString() != firstAddress {
		t.Fatal("Revoked link should correspond to the first address.")
	}
}

// Make sure the btc engine uses the secret store.
func TestBTCWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		e := NewBTCEngine(firstAddress, true /* force */, tc.G)
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			SecretUI: secretUI,
		}
		err := RunEngine(e, ctx)
		if err != nil {
			t.Fatal(err)
		}
	})
}
