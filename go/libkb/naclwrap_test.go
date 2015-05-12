package libkb

import (
	"encoding/base64"
	"testing"
)

// Make sure that Verify accepts the output of SignToString.
func TestVerifyStringAccept(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	msg := []byte("test message")
	sig, _, err := keyPair.SignToString(msg)
	if err != nil {
		t.Fatal(err)
	}

	_, err = keyPair.VerifyString(sig, msg)
	if err != nil {
		t.Error(err)
	}
}

// Make sure that Verify rejects various types of bad signatures.
func TestVerifyStringReject(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	msg := []byte("test message")
	sig, _, err := keyPair.SignToString(msg)
	if err != nil {
		t.Fatal(err)
	}

	// Corrupt signature.

	sigBytes, err := base64.StdEncoding.DecodeString(sig)
	if err != nil {
		t.Fatal(err)
	}

	_, err = keyPair.VerifyString(base64.StdEncoding.EncodeToString(append(sigBytes, []byte("corruption")...)), msg)
	if err == nil {
		t.Error("Corrupt signature unexpectedly passes")
	}

	// Corrupt message.

	_, err = keyPair.VerifyString(sig, append(msg, []byte("corruption")...))
	if err == nil {
		t.Error("Signature for corrupt message unexpectedly passes")
	}

	keyPair2, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	// Signature with different key.

	sig2, _, err := keyPair2.SignToString(msg)
	if err != nil {
		t.Fatal(err)
	}

	_, err = keyPair.VerifyString(sig2, msg)
	if err == nil {
		t.Error("Signature with different key unexpectedly passes")
	}

	// Append different signature.

	_, err = keyPair.Verify(sig+sig2, msg)
	if err == nil {
		t.Error("Signature with appended different signature unexpectedly passes")
	}

	// Prepend invalid signature.

	_, err = keyPair.Verify(sig2+sig, msg)
	if err == nil {
		t.Error("Signature with preprended invalid signature unexpectedly passes")
	}
}

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
func TestVerifyBytesReject(t *testing.T) {
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
