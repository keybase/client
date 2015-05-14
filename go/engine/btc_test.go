package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	// keybase_1 "github.com/keybase/client/protocol/go"
)

func getCurrentBTCAddr(t *testing.T, username string) string {
	u, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		t.Fatal(err)
	}
	cryptoLink := u.IDTable().ActiveCryptocurrency()
	if cryptoLink == nil {
		return ""
	}
	return cryptoLink.ToDisplayString()
}

func TestBTC(t *testing.T) {
	tc := SetupEngineTest(t, "btc")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "btc")

	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}

	// First test setting a bad address; this should fail.
	e := NewBTCEngine("somejunk", false /* force */, tc.G)
	err := RunEngine(e, ctx)
	if err == nil {
		t.Fatalf("Bad address should have failed.")
	}
	current := getCurrentBTCAddr(t, u.Username)
	if current != "" {
		t.Fatalf("No address should be set")
	}

	// Now set a real address; this should succeed.
	firstAddress := "17JyYCvn37BodyLbZdKQrW3WNbW7JcsvAJ"
	e = NewBTCEngine(firstAddress, false /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentBTCAddr(t, u.Username)
	if current != firstAddress {
		t.Fatalf("Expected btc address '%s'. Found '%s'.", firstAddress, current)
	}

	secondAddress := "1kwg3FnLysQAi8Wqu37KqBwTUaUGiL7t1"

	// Test overwriting it without --force; should fail.
	e = NewBTCEngine(secondAddress, false /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err == nil {
		t.Fatal("Overwriting a btc address should fail without --force.")
	} else if !strings.Contains(err.Error(), "--force") {
		t.Fatal("Error should mention the --force flag.")
	}
	current = getCurrentBTCAddr(t, u.Username)
	if current != firstAddress {
		t.Fatalf("Address should not have changed.")
	}

	// Now test the overwrite with the --force flag; should succeed.
	e = NewBTCEngine(secondAddress, true /* force */, tc.G)
	err = RunEngine(e, ctx)
	if err != nil {
		t.Fatal(err)
	}
	current = getCurrentBTCAddr(t, u.Username)
	if current != secondAddress {
		t.Fatalf("Expected btc address '%s'. Found '%s'.", secondAddress, current)
	}

	// Make sure the previous link was revoked.
	loadedUser, err := libkb.LoadUser(libkb.LoadUserArg{Name: u.Username})
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
