// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"testing"

	"golang.org/x/crypto/nacl/box"
)

// Tests to make sure that the nacl/box functions behave as we expect
// them to.

// Convenience functions for testing.

func makeKeyPairsOrBust(t *testing.T) (NaclDHKeyPair, NaclDHKeyPair) {
	kp1, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	kp2, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	return kp1, kp2
}

func boxSeal(msg []byte, nonce [24]byte, peersPublicKey NaclDHKeyPublic, privateKey *NaclDHKeyPrivate) []byte {
	return box.Seal(nil, msg, &nonce, (*[32]byte)(&peersPublicKey), (*[32]byte)(privateKey))
}

func boxOpen(encryptedData []byte, nonce [24]byte, peersPublicKey NaclDHKeyPublic, privateKey *NaclDHKeyPrivate) ([]byte, error) {
	data, ok := box.Open(nil, encryptedData, &nonce, (*[32]byte)(&peersPublicKey), (*[32]byte)(privateKey))
	if ok {
		return data, nil
	}
	return data, DecryptionError{}
}

// Test that sealing a message and then opening it works and returns
// the original message.
func TestSealOpen(t *testing.T) {
	kp1, kp2 := makeKeyPairsOrBust(t)

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := boxSeal(expectedData, nonce, kp1.Public, kp2.Private)

	data, err := boxOpen(encryptedData, nonce, kp2.Public, kp1.Private)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(data, expectedData) {
		t.Errorf("Expected %v, got %v", expectedData, data)
	}

	// Apparently, you can open a message you yourself have sealed.

	data, err = boxOpen(encryptedData, nonce, kp1.Public, kp2.Private)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(data, expectedData) {
		t.Errorf("Expected %v, got %v", expectedData, data)
	}
}

// Test that opening a message with the wrong key combinations won't
// work.
func TestOpenWrongKeyCombos(t *testing.T) {
	kp1, kp2 := makeKeyPairsOrBust(t)

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := boxSeal(expectedData, nonce, kp1.Public, kp2.Private)

	// Run through all possible invalid combinations.

	var data []byte
	var err error

	data, err = boxOpen(encryptedData, nonce, kp1.Public, (*NaclDHKeyPrivate)(&kp1.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp1.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp1.Public, (*NaclDHKeyPrivate)(&kp2.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp1.Private), (*NaclDHKeyPrivate)(&kp1.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp1.Private), kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp1.Private), (*NaclDHKeyPrivate)(&kp2.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp1.Private), kp2.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp2.Public, (*NaclDHKeyPrivate)(&kp1.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp2.Public, (*NaclDHKeyPrivate)(&kp2.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp2.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp2.Private), (*NaclDHKeyPrivate)(&kp1.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp2.Private), kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp2.Private), (*NaclDHKeyPrivate)(&kp2.Public))
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, (NaclDHKeyPublic)(*kp2.Private), kp2.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}
}

// Test that opening a message with the wrong keys won't work.
func TestOpenWrongKeys(t *testing.T) {
	kp1, kp2 := makeKeyPairsOrBust(t)

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := boxSeal(expectedData, nonce, kp1.Public, kp2.Private)

	kp3, kp4 := makeKeyPairsOrBust(t)

	// Run through all possible invalid combinations (not covered
	// by TestOpenWrongKeyCombos).

	var data []byte
	var err error

	data, err = boxOpen(encryptedData, nonce, kp1.Public, kp3.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp1.Public, kp4.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp3.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp4.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp3.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp3.Public, kp2.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp4.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(encryptedData, nonce, kp4.Public, kp2.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}
}

// Test that opening a modified message doesn't work.
func TestOpenCorruptMessage(t *testing.T) {
	kp1, kp2 := makeKeyPairsOrBust(t)

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := boxSeal(expectedData, nonce, kp1.Public, kp2.Private)

	var data []byte
	var err error

	data, err = boxOpen(encryptedData[:len(encryptedData)-1], nonce, kp2.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	data, err = boxOpen(append(encryptedData, 0), nonce, kp2.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	encryptedData[0] = ^encryptedData[0]

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}

	encryptedData[box.Overhead] = ^encryptedData[box.Overhead]

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}
}

// Test that opening a message with a modified nonce doesn't work.
func TestOpenCorruptNonce(t *testing.T) {
	kp1, kp2 := makeKeyPairsOrBust(t)

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := boxSeal(expectedData, nonce, kp1.Public, kp2.Private)

	var data []byte
	var err error

	nonce[0] = ^nonce[0]

	data, err = boxOpen(encryptedData, nonce, kp2.Public, kp1.Private)
	if err == nil {
		t.Errorf("Open unexpectedly worked: %v", data)
	}
}
