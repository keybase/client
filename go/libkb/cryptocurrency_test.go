// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"testing"
)

func doBase58Test(t *testing.T, startingHex, expectedBase58 string) {
	startingBytes, err := hex.DecodeString(startingHex)
	if err != nil {
		t.Fatalf("Not valid hex: '%s'", startingHex)
	}
	base58 := Encode58(startingBytes)
	if base58 != expectedBase58 {
		t.Fatalf("'%s' was converted to '%s' instead of '%s'", startingHex, base58, expectedBase58)
	}
	backToBytes, err := Decode58(base58)
	if err != nil {
		t.Fatalf("Not valid base58: '%s'", base58)
	}
	backToHex := hex.EncodeToString(backToBytes)
	if backToHex != startingHex {
		t.Fatalf("'%s' round tripped to '%s'", startingHex, backToHex)
	}
}

func TestBase58(t *testing.T) {
	doBase58Test(t, "", "")
	doBase58Test(t, "00", "1")
	doBase58Test(t, "0000", "11")
	doBase58Test(t, "01", "2")
	doBase58Test(t, "00ff00", "1LQX")
}

var testVectors = []struct {
	address    string
	wantedType CryptocurrencyType
}{
	{"zcCk6rKzynC4tT1Rmg325A5Xw81Ck3S6nD6mtPWCXaMtyFczkyU4kYjEhrcz2QKfF5T2siWGyJNxWo43XWT3qk5YpPhFGj2", CryptocurrencyTypeZCashShielded},
	{"zcCk6rKzynC4tT1Rmg325A5Xw81Ck3S6nD6mtPWCXaMtyFczkyU4kYjEhrcz2QKfF5T2siWGyJNxWo43XWT3qk5YpPhFGj2x", CryptocurrencyTypeNone},
	{"zcCk6rKzynC4tT1Rmg325A5Xw81Ck3S6nD6mtPWCXaMtyFczkyU4kYjEhrcz2QKfF5T2siWGyJNxWo43XWT3qk5YpPhFGj3", CryptocurrencyTypeNone},
	{"t1c3Ebc6FBbWuirNrjJ6HbS4KHLb6Dbh5xL", CryptocurrencyTypeZCashTransparentP2PKH},
	{"t1c3Ebc6FBbWuirNrjJ6HbS4KHLb6Dbh5xLx", CryptocurrencyTypeNone},
	{"t1c3Ebc6FBbWuirNrjJ6HbS4KHLb6Dbh5xx", CryptocurrencyTypeNone},
	{"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", CryptocurrencyTypeBTCMultiSig},
	{"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyx", CryptocurrencyTypeNone},
	{"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLx", CryptocurrencyTypeNone},
	{"zs165czn4y5jfa552kux7yl3y5l8ge4cl6af45y9dh3yzfnkgd68vajyjdlkht54ve958qx693jjak", CryptocurrencyTypeZCashSapling},
	{"zs1x2q4pej08shm9pd5fx8jvl97f8f7t8sej8lsgp08jsczxsucr5gkff0yasc0gc43dtv3wczerv5", CryptocurrencyTypeZCashSapling},
	{"zs1fw4tgx9gccv2f8af6ugu727slx7pq0nc46yflcuqyluruxtcmg20hxh3r4d9ec9yejj6gfrf2hc", CryptocurrencyTypeZCashSapling},
	{"zs1fw4tgx9gccv2f8af6ugu727slx7pq0nc46yflcuqyluruxtcmg20hxh3r4d9ec9yejj6gfrf2hd", CryptocurrencyTypeNone},
}

func TestCryptocurrencyParseAndCheck(t *testing.T) {
	for i, v := range testVectors {
		typ, _, err := CryptocurrencyParseAndCheck(v.address)
		if typ != v.wantedType {
			t.Fatalf("Address %s (%d): got wrong CryptocurrencyTyp: %d != %d (%v)", v.address, i, typ, v.wantedType, err)
		}
	}
}

func TestAddressValidation(t *testing.T) {
	validAddr := "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"
	invalidAddr := "4J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy" // changed first digit

	_, _, err := BtcAddrCheck(validAddr, nil)
	if err != nil {
		t.Fatal("Failed to validate a good address.")
	}

	_, _, err = BtcAddrCheck(invalidAddr, nil)
	if err == nil {
		t.Fatal("Failed to catch a bad address.")
	}
}
