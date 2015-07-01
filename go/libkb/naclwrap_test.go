package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"testing"
)

// Test that VerifyString accepts the output of SignToString.
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

// Test that VerifyString rejects various types of bad signatures.
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

	// Signature with different key.

	keyPair2, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	sig2, _, err := keyPair2.SignToString(msg)
	if err != nil {
		t.Fatal(err)
	}

	_, err = keyPair.VerifyString(sig2, msg)
	if err == nil {
		t.Error("Signature with different key unexpectedly passes")
	}

	// Append different signature.

	_, err = keyPair.VerifyString(sig+sig2, msg)
	if err == nil {
		t.Error("Signature with appended different signature unexpectedly passes")
	}

	// Prepend invalid signature.

	_, err = keyPair.VerifyString(sig2+sig, msg)
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
	sig := keyPair.Private.Sign(msg)
	if !keyPair.Public.Verify(msg, sig) {
		t.Error(VerificationError{})
	}
}

// Test that VerifyBytes rejects various types of bad signatures.
func TestVerifyBytesReject(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	msg := []byte("test message")
	sig := keyPair.Private.Sign(msg)

	// Corrupt signature.

	var corruptSig NaclSignature
	copy(corruptSig[:], sig[:])
	corruptSig[0] = ^sig[0]
	if keyPair.Public.Verify(msg, &corruptSig) {
		t.Error("Corrupt signature unexpectedly passes")
	}

	// Corrupt message.

	corruptMsg := append(msg, []byte("corruption")...)
	if keyPair.Public.Verify(corruptMsg, sig) {
		t.Error("Signature for corrupt message unexpectedly passes")
	}

	// Signature with different key.

	keyPair2, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	sig2 := keyPair2.Private.Sign(msg)
	if keyPair.Public.Verify(msg, sig2) {
		t.Error("Signature with different key unexpectedly passes")
	}
}

func TestNaclEncryptEphemeral(t *testing.T) {
	keyPair, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	ctext, err := keyPair.EncryptToString(msg, nil)
	if err != nil {
		t.Fatal(err)
	}
	out, kid, err := keyPair.DecryptFromString(ctext)
	if err != nil {
		t.Fatal(err)
	}
	if !FastByteArrayEq(out, msg) {
		t.Error("Message mismatch: %s != %s", msg, out)
	}
	if kid.Eq(keyPair.GetKid()) {
		t.Error("KID should be an ephemeral key, not ours")
	}
}

func TestNaclEncryptKnown(t *testing.T) {
	recvr, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	sender, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	ctext, err := recvr.EncryptToString(msg, &sender)
	if err != nil {
		t.Fatal(err)
	}
	out, kid, err := recvr.DecryptFromString(ctext)
	if err != nil {
		t.Fatal(err)
	}
	if !FastByteArrayEq(out, msg) {
		t.Error("Message mismatch: %s != %s", msg, out)
	}
	if !kid.Eq(sender.GetKid()) {
		t.Error("KID mismatch for sender")
	}
}

func TestNaclDecryptFromIced(t *testing.T) {
	seed := "b26ba6f6865b28f9332620c73c2984e2d2a8a83ef5eb59ca47d3b70cfa9f222f"
	ctext := "g6Rib2R5hapjaXBoZXJ0ZXh0xEw2dXZRKyUI5wbSfQGSv61xVIl/cpD8hFN+Gsc5LGEtuXmGG1+1rUFv4QWizfLgqhywaitotmApYJv07zFTUT5sxOU+i2er43XQkkwmqGVuY190eXBlIaVub25jZcQY/rYiRGjPmmxurm5PMlhJuJwP9jk7UJIFrHJlY2VpdmVyX2tlecQjASHyQFIJdlHbnV1oT3MKne5ob7Rmf0emMciNbkD1IyfCKgqqc2VuZGVyX2tlecQjASFKiKO16sYJaloJ4URJM+pL6BSYJcz8M/Za2MSrKCvqawqjdGFnzQIDp3ZlcnNpb24B"
	plaintext := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	seedBytes, err := hex.DecodeString(seed)
	if err != nil {
		t.Fatal(err)
	}
	var secret [32]byte
	copy(secret[:], seedBytes)
	key, err := MakeNaclDHKeyPairFromSecret(secret)
	if err != nil {
		t.Fatal(err)
	}

	out, _, err := key.DecryptFromString(ctext)
	if err != nil {
		t.Fatal(err)
	}

	if !FastByteArrayEq(out, plaintext) {
		t.Error("failed to match plaintext")
	}
}
