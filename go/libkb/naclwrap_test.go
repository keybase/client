package libkb

import (
	"testing"
)

// Test that VerifyBytes accepts the output of SignToBytes.
func TestVerifyBytesAccept(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	msg := []byte("test message")
	sig, err := keyPair.SignToBytes(msg)
	if err != nil {
		t.Fatal(err)
	}

	err = keyPair.VerifyBytes(sig, msg)
	if err != nil {
		t.Error(err)
	}
}

// Test that VerifyBytes rejects various types of bad signatures.
func TestVerifyReject(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	msg := []byte("test message")
	sig, err := keyPair.SignToBytes(msg)
	if err != nil {
		t.Fatal(err)
	}

	// Corrupt signature.

	err = keyPair.VerifyBytes(append(sig, []byte("corruption")...), msg)
	if err == nil {
		t.Error("Corrupt signature unexpectedly passes")
	}

	// Corrupt message.

	err = keyPair.VerifyBytes(sig, append(msg, []byte("corruption")...))
	if err == nil {
		t.Error("Signature for corrupt message unexpectedly passes")
	}

	// Signature with different key.

	keyPair2, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	sig2, err := keyPair2.SignToBytes(msg)
	if err != nil {
		t.Fatal(err)
	}

	err = keyPair.VerifyBytes(sig2, msg)
	if err == nil {
		t.Error("Signature with different key unexpectedly passes")
	}

	// Append different signature.

	err = keyPair.VerifyBytes(append(sig, sig2...), msg)
	if err == nil {
		t.Error("Signature with appended different signature unexpectedly passes")
	}

	// Prepend invalid signature.

	err = keyPair.VerifyBytes(append(sig2, sig...), msg)
	if err == nil {
		t.Error("Signature with preprended invalid signature unexpectedly passes")
	}
}
