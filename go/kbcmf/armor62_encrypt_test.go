// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"crypto/rand"
	"github.com/keybase/client/go/encoding/basex"
	"io/ioutil"
	"testing"
)

func encryptArmor62RandomData(t *testing.T, sz int) ([]byte, string) {
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}

	ciphertext, err := EncryptArmor62Seal(msg, sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}
	return msg, ciphertext
}

func TestEncryptArmor62(t *testing.T) {
	plaintext, ciphertext := encryptArmor62RandomData(t, 1024)
	plaintext2, err := Dearmor62DecryptOpen(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatalf("bad message back out")
	}
}

func TestDearmor62DecryptSlowReader(t *testing.T) {
	sz := 1024*16 + 3
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}

	ciphertext, err := EncryptArmor62Seal(msg, sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}

	dec, frame, err := NewDearmor62DecryptStream(&slowReader{[]byte(ciphertext)}, kr)
	if err != nil {
		t.Fatal(err)
	}

	plaintext, err := ioutil.ReadAll(dec)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkArmor62Frame(frame); err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(plaintext, msg) {
		t.Fatalf("bad message back out")
	}
}

func TestBadArmor62(t *testing.T) {
	_, ciphertext := encryptArmor62RandomData(t, 24)
	bad1 := ciphertext[0:2] + "䁕" + ciphertext[2:]
	if _, err := Dearmor62DecryptOpen(bad1, kr); err != ErrBadArmorFrame {
		t.Fatalf("Wanted error %v but got %v", ErrBadArmorFrame, err)
	}
	if _, _, _, err := Armor62Open(bad1); err != ErrBadArmorFrame {
		t.Fatalf("Wanted error %v but got %v", ErrBadArmorFrame, err)
	}

	bad2 := ciphertext[0:1] + "z" + ciphertext[2:]
	_, err := Dearmor62DecryptOpen(bad2, kr)
	if _, ok := err.(ErrBadArmorHeader); !ok {
		t.Fatalf("Wanted of type ErrBadArmorHeader; got %v", err)
	}

	l := len(ciphertext)
	bad3 := ciphertext[0:(l-8)] + "z" + ciphertext[(l-7):]
	_, err = Dearmor62DecryptOpen(bad3, kr)
	if _, ok := err.(ErrBadArmorFooter); !ok {
		t.Fatalf("Wanted of type ErrBadArmorFooter; got %v", err)
	}

	bad4 := ciphertext + "䁕"
	_, err = Dearmor62DecryptOpen(bad4, kr)
	if err != ErrTrailingGarbage {
		t.Fatalf("Wanted error %v but got %v", ErrTrailingGarbage, err)
	}

	bad5 := ciphertext[0:(l-8)] + "䁕" + ciphertext[(l-7):]
	if _, _, _, err := Armor62Open(bad5); err != ErrBadArmorFrame {
		t.Fatalf("Wanted error %v but got %v", ErrBadArmorFrame, err)
	}
	half := l >> 1
	bad6 := ciphertext[0:half] + "䁕" + ciphertext[(half+1):]
	_, _, _, err = Armor62Open(bad6)
	if _, ok := err.(basex.CorruptInputError); !ok {
		t.Fatalf("Wanted error of type CorruptInputError but got %v", err)
	}
}
