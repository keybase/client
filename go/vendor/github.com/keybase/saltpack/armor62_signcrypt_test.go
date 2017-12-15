// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"testing"
)

func TestSigncryptArmor62(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	sender := makeSigningKey(t, keyring)

	ciphertext, err := SigncryptArmor62Seal(msg, keyring, sender, receiverBoxKeys, nil, ourBrand)
	if err != nil {
		t.Fatal(err)
	}

	_, output, brand, err := Dearmor62SigncryptOpen(ciphertext, keyring, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg, output) {
		t.Fatalf("bad message back out")
	}
	brandCheck(t, brand)
}
