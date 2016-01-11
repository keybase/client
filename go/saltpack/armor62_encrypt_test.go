// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"io/ioutil"
	"testing"

	"github.com/keybase/client/go/encoding/basex"
)

func encryptArmor62RandomData(t *testing.T, sz int) ([]byte, string) {
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	ciphertext, err := EncryptArmor62Seal(msg, sndr, receivers, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	return msg, ciphertext
}

func TestEncryptArmor62(t *testing.T) {
	plaintext, ciphertext := encryptArmor62RandomData(t, 1024)
	_, plaintext2, brand, err := Dearmor62DecryptOpen(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatalf("bad message back out")
	}
	brandCheck(t, brand)
}

func TestDearmor62DecryptSlowReader(t *testing.T) {
	sz := 1024*16 + 3
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	ciphertext, err := EncryptArmor62Seal(msg, sndr, receivers, ourBrand)
	if err != nil {
		t.Fatal(err)
	}

	_, dec, frame, err := NewDearmor62DecryptStream(&slowReader{[]byte(ciphertext)}, kr)
	if err != nil {
		t.Fatal(err)
	}

	plaintext, err := ioutil.ReadAll(dec)
	if err != nil {
		t.Fatal(err)
	}
	if brand, err := CheckArmor62Frame(frame, MessageTypeEncryption); err != nil {
		t.Fatal(err)
	} else {
		brandCheck(t, brand)
	}

	if !bytes.Equal(plaintext, msg) {
		t.Fatalf("bad message back out")
	}
}

func TestBadArmor62(t *testing.T) {
	_, ciphertext := encryptArmor62RandomData(t, 24)
	bad1 := ciphertext[0:2] + "䁕" + ciphertext[2:]
	_, _, _, err := Dearmor62DecryptOpen(bad1, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error type %T but got type %T", ErrBadFrame{}, err)
	}
	_, _, _, err = Armor62Open(bad1)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error type %T but got type %T", ErrBadFrame{}, err)
	}

	bad2 := ciphertext[0:1] + "z" + ciphertext[2:]
	_, _, _, err = Dearmor62DecryptOpen(bad2, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted of type ErrBadFrame; got %v", err)
	}

	l := len(ciphertext)
	bad3 := ciphertext[0:(l-8)] + "z" + ciphertext[(l-7):]
	_, _, _, err = Dearmor62DecryptOpen(bad3, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted of type ErrBadFrmae; got %v", err)
	}

	bad4 := ciphertext + "䁕"
	_, _, _, err = Dearmor62DecryptOpen(bad4, kr)
	if err != ErrTrailingGarbage {
		t.Fatalf("Wanted error %v but got %v", ErrTrailingGarbage, err)
	}

	bad5 := ciphertext[0:(l-8)] + "䁕" + ciphertext[(l-7):]
	_, _, _, err = Armor62Open(bad5)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error type %T but got type %T", ErrBadFrame{}, err)
	}
	half := l >> 1
	bad6 := ciphertext[0:half] + "䁕" + ciphertext[(half+1):]
	_, _, _, err = Armor62Open(bad6)
	if _, ok := err.(basex.CorruptInputError); !ok {
		t.Fatalf("Wanted error of type CorruptInputError but got %v", err)
	}
}
