// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/saltpack/encoding/basex"
)

func encryptArmor62RandomData(t *testing.T, version Version, sz int) ([]byte, string) {
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	ciphertext, err := EncryptArmor62Seal(version, msg, sndr, receivers, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	return msg, ciphertext
}

func testEncryptArmor62(t *testing.T, version Version) {
	plaintext, ciphertext := encryptArmor62RandomData(t, version, 1024)
	_, plaintext2, brand, err := Dearmor62DecryptOpen(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatalf("bad message back out")
	}
	brandCheck(t, brand)
}

func testDearmor62DecryptSlowReader(t *testing.T, version Version) {
	sz := 1024*16 + 3
	msg := randomMsg(t, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	ciphertext, err := EncryptArmor62Seal(version, msg, sndr, receivers, ourBrand)
	if err != nil {
		t.Fatal(err)
	}

	_, dec, frame, err := NewDearmor62DecryptStream(SingleVersionValidator(version), &slowReader{[]byte(ciphertext)}, kr)
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

func testNewlineInFrame(t *testing.T, version Version) {
	plaintext, ciphertext := encryptArmor62RandomData(t, version, 1024)

	//newline space space tab space
	ss := []string{"\n\n>   ", ciphertext[0:10], "\n  	 ", ciphertext[11:]}
	ciphertext = strings.Join(ss, "")

	_, plaintext2, brand, err := Dearmor62DecryptOpen(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatalf("bad message back out")
	}
	brandCheck(t, brand)
}

func testBadArmor62(t *testing.T, version Version) {
	_, ciphertext := encryptArmor62RandomData(t, version, 24)
	bad1 := ciphertext[0:2] + "䁕" + ciphertext[2:]
	_, _, _, err := Dearmor62DecryptOpen(SingleVersionValidator(version), bad1, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error type %T but got type %T", ErrBadFrame{}, err)
	}
	_, _, _, err = Armor62Open(bad1)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error type %T but got type %T", ErrBadFrame{}, err)
	}

	bad2 := ciphertext[0:1] + "z" + ciphertext[2:]
	_, _, _, err = Dearmor62DecryptOpen(SingleVersionValidator(version), bad2, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error of type ErrBadFrame; got %v", err)
	}

	l := len(ciphertext)
	bad3 := ciphertext[0:(l-8)] + "z" + ciphertext[(l-7):]
	_, _, _, err = Dearmor62DecryptOpen(SingleVersionValidator(version), bad3, kr)
	if _, ok := err.(ErrBadFrame); !ok {
		t.Fatalf("Wanted error of type ErrBadFrame; got %v", err)
	}

	bad4 := ciphertext + "䁕"
	_, _, _, err = Dearmor62DecryptOpen(SingleVersionValidator(version), bad4, kr)
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

func TestArmor62Encrypt(t *testing.T) {
	tests := []func(*testing.T, Version){
		testEncryptArmor62,
		testDearmor62DecryptSlowReader,
		testNewlineInFrame,
		testBadArmor62,
	}
	runTestsOverVersions(t, "test", tests)
}
