package libkb

import (
	"bytes"
	"testing"

	"golang.org/x/crypto/nacl/box"
)

// Tests to make sure that the nacl/box functions behave as we expect
// them to.

// Test that sealing a message and then opening it works and returns
// the original message.
func TestSealOpen(t *testing.T) {
	kp1, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	kp2, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	expectedData := []byte{0, 1, 2, 3, 4}
	nonce := [24]byte{5, 6, 7, 8}

	encryptedData := box.Seal(nil, expectedData, &nonce, (*[32]byte)(&kp1.Public), (*[32]byte)(kp2.Private))

	data, ok := box.Open(nil, encryptedData, &nonce, (*[32]byte)(&kp2.Public), (*[32]byte)(kp1.Private))
	if !ok {
		t.Fatal(DecryptionError{})
	}

	if !bytes.Equal(data, expectedData) {
		t.Fatalf("Expected %v, got %v", expectedData, data)
	}
}
