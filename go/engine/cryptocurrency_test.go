// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func getCurrentCryptocurrencyAddr(tc libkb.TestContext, username string, family libkb.CryptocurrencyFamily) string {
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	require.NoError(tc.T, err)
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
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testCryptocurrency(t, sigVersion)
	})
}

func _testCryptocurrency(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "Cryptocurrency")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "btc")

	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}

	// First test setting a bad address; this should fail.
	sv := keybase1.SigVersion(sigVersion)
	e := NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: "somejunk", SigVersion: &sv})
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, e)
	require.Error(t, err,
		"Bad address should have failed.")
	current := getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Empty(t, current, "No address should be set")

	// Now set a real address, but with the wrong family. This should fail
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, WantedFamily: "zcash", SigVersion: &sv})
	err = RunEngine2(m, e)
	require.Error(t, err,
		"Wanted an error for wrong address type")
	require.Empty(t, current, "No address should be set")

	// Now set a real address; this should succeed.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, WantedFamily: "bitcoin", SigVersion: &sv})
	err = RunEngine2(m, e)
	require.NoError(t, err)
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, firstAddress, current, "Expected Cryptocurrency address '%s'. Found '%s'.", firstAddress, current)

	// Test overwriting it without --force; should fail.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: secondAddress, SigVersion: &sv})
	err = RunEngine2(m, e)
	if err == nil {
		require.Error(t, err,
			"Overwriting a Cryptocurrency address should fail without --force.")
	} else if _, ok := err.(libkb.ExistsError); !ok {
		require.True(t, ok,
			"Error should by typed 'libkb.ExistsError'")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, firstAddress, current, "Address should not have changed.")

	// Now test the overwrite with the --force flag; should succeed.
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: secondAddress, Force: true, SigVersion: &sv})
	err = RunEngine2(m, e)
	require.NoError(t, err)
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, secondAddress, current, "Expected Cryptocurrency address '%s'. Found '%s'.", secondAddress, current)

	// Make sure the previous link was revoked.
	loadedUser, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	require.NoError(t, err,
		"Failed to load user.")
	revoked := loadedUser.IDTable().GetRevokedCryptocurrencyForTesting()
	if len(revoked) != 1 {
		require.FailNow(t, "Expected 1 revoked link.")
	} else if revoked[0].ToDisplayString() != firstAddress {
		require.FailNow(t, "Revoked link should correspond to the first address.")
	}

	// Check that we can also add a Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash1, SigVersion: &sv})
	err = RunEngine2(m, e)
	require.NoError(t, err,
		"We should be able to add a Zcash in addition to a BTC address")
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, secondAddress, current, "BTC Address should not have changed.")
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	require.Equal(t, zcash1, current, "Zcash address didn't take")

	// Check that we can't also add a second Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash2, SigVersion: &sv})
	err = RunEngine2(m, e)
	if err == nil {
		require.Error(t, err,
			"Overwriting a second Zcash address should fail without --force.")
	} else if _, ok := err.(libkb.ExistsError); !ok {
		require.True(t, ok,
			"Error should by typed 'libkb.ExistsError'")
	}
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, secondAddress, current, "BTC Address should not have changed.")
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	require.Equal(t, zcash1, current, "Zcash address didn't take")

	// Check that we can't also add a second Zcash address
	e = NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: zcash2, Force: true, SigVersion: &sv})
	err = RunEngine2(m, e)
	require.NoError(t, err,
		"Forcing Zcash overwrite should have worked")
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyBitcoin)
	require.Equal(t, secondAddress, current, "BTC Address should not have changed.")
	current = getCurrentCryptocurrencyAddr(tc, u.Username, libkb.CryptocurrencyFamilyZCash)
	require.Equal(t, zcash2, current, "Zcash address force didn't take")

	// Make sure the previous link was revoked.
	loadedUser, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, u.Username))
	require.NoError(t, err,
		"Failed to load user.")
	revoked = loadedUser.IDTable().GetRevokedCryptocurrencyForTesting()
	if len(revoked) != 2 {
		require.FailNow(t, fmt.Sprintf("Expected 2 revoked links; got %d", len(revoked)))
	} else if revoked[0].ToDisplayString() != firstAddress {
		require.FailNow(t, "Revoked link should correspond to the first address.")
	} else if revoked[1].ToDisplayString() != zcash1 {
		require.FailNow(t, "Revoked link should correspond to the first Zcash address.")
	}
}

func TestCryptocurrencyWithSecretStore(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testCryptocurrencyWithSecretStore(t, sigVersion)
	})
}

// Make sure the Cryptocurrency engine uses the secret store.
func _testCryptocurrencyWithSecretStore(t *testing.T, sigVersion libkb.SigVersion) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, _ *FakeUser, secretUI libkb.SecretUI,
	) {
		sv := keybase1.SigVersion(sigVersion)
		e := NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, Force: true, SigVersion: &sv})
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			SecretUI: secretUI,
		}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, e)
		require.NoError(t, err)
	})
}
