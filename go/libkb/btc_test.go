// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
