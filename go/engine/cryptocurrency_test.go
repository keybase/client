// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func getCurrentCryptocurrencyAddr(tc libkb.TestContext, username string, family libkb.CryptocurrencyFamily) string {
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	if err != nil {
		tc.T.Fatal(err)
	}
	cryptoLink := u.IDTable().ActiveCryptocurrency(family)
	if cryptoLink == nil {
		return ""
	}
	return cryptoLink.ToDisplayString()
}

const (
	firstAddress  = "17JyYCvn37BodyLbZdKQrW3WNbW7JcsvAJ"
	secondAddress = "1kwg3FnLysQAi8Wqu37KqBwTUaUGiL7t1"
	zcash1        = "zcCk6rKzynC4tT1Rmg325A5Xw81Ck3S6nD6mtPWCXaMtyFczkyU4kYjEhrcz2QKfF5T2siWGyJNxWo43XWT3qk5YpPhFGj2"
	zcash2        = "t1c3Ebc6FBbWuirNrjJ6HbS4KHLb6Dbh5xL"
)

func TestCryptocurrency(t *testing.T) {
	tc := SetupEngineTest(t, "Cryptocurrency")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "btc")

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}

	// First test setting a bad address; this should fail.
	e := NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: "somejunk"})
	err := RunEngine(e, ctx)
	if err == nil {
		t.Fatalf("Bad address should have failed.")
	}
	current := getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != "" {
		t.Fatalf("No address should be set")
	}

	// Now set a real address, but with the wrong family. This should fail
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, WantedFamily: "zcash"})
	err = RunEngine(e, ctx)
	if err == nil {
		t.Fatal("Wanted an error for wrong adddress type")
	}
	if current != "" {
		t.Fatalf("No address should be set")
	}

	// Now set a real address; this should succeed.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, WantedFamily: "bitcoin"})
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != firstAddress {
		t.Fatalf("Expected Cryptocurrency address '%s'. Found '%s'.", firstAddress, current)
	}

	// Test overwriting it without --force; should fail.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: secondAddress})
	err = RunEngine(e, ctx)
	if err == nil {
		t.Fatal("Overwriting a Cryptocurrency address should fail without --force.")
	} else if _, ok := err.(libkb.ExistsError); !ok {
		t.Fatal("Error should by typed 'libkb.ExistsError'")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != firstAddress {
		t.Fatalf("Address should not have changed.")
	}

	// Now test the overwrite with the --force flag; should succeed.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: secondAddress, Force: true})
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != secondAddress {
		t.Fatalf("Expected Cryptocurrency address '%s'. Found '%s'.", secondAddress, current)
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

	// Check that we can also add a Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash1})
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal("We should be able to add a zcash in addition to a BTC address")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != secondAddress {
		t.Fatalf("BTC Address should not have changed.")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	if current != zcash1 {
		t.Fatalf("Zcash address didn't take")
	}

	// Check that we can't also add a second Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash2})
	err = RunEngine(e, ctx)
	if err == nil {
		t.Fatal("Overwriting a second Zcash address should fail without --force.")
	} else if _, ok := err.(libkb.ExistsError); !ok {
		t.Fatal("Error should by typed 'libkb.ExistsError'")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != secondAddress {
		t.Fatalf("BTC Address should not have changed.")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	if current != zcash1 {
		t.Fatalf("Zcash address didn't take")
	}

	// Check that we can't also add a second Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash2, Force: true})
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal("Forcing zcash overwrite should have worked")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	if current != secondAddress {
		t.Fatalf("BTC Address should not have changed.")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	if current != zcash2 {
		t.Fatalf("Zcash address force didn't take")
	}

	// Make sure the previous link was revoked.
	loadedUser, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	if err != nil {
		t.Fatalf("Failed to load user.")
	}
	revoked = loadedUser.IDTable().GetRevokedCryptocurrencyForTesting()
	if len(revoked) != 2 {
		t.Fatalf("Expected 2 revoked links; got %d", len(revoked))
	} else if revoked[0].ToDisplayString() != firstAddress {
		t.Fatal("Revoked link should correspond to the first address.")
	} else if revoked[1].ToDisplayString() != zcash1 {
		t.Fatal("Revoked link should correspond to the first zcash address.")
	}
}

// Make sure the Cryptocurrency engine uses the secret store.
func TestCryptocurrencyWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		e := NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, Force: true})
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
