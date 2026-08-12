// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/stretchr/testify/require"
)

// Test that VerifyString accepts the output of SignToString.
func TestVerifyStringAccept(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	t.Logf("keyPair: Public: %+v, Private: %+v", keyPair.Public, keyPair.Private)

	msg := []byte("test message")
	sig, _, err := keyPair.SignToString(msg)
	require.NoError(t, err)

	t.Logf("sig: %+v", sig)

	_, err = keyPair.VerifyString(nil, sig, msg)
	require.NoError(t, err, err)
}

// Test that VerifyString rejects various types of bad signatures.
func TestVerifyStringReject(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	msg := []byte("test message")
	sig, _, err := keyPair.SignToString(msg)
	require.NoError(t, err)

	// Corrupt signature.

	sigBytes, err := base64.StdEncoding.DecodeString(sig)
	require.NoError(t, err)

	_, err = keyPair.VerifyString(nil, base64.StdEncoding.EncodeToString(append(sigBytes, []byte("corruption")...)), msg)
	require.NotNil(t, err, "Corrupt signature unexpectedly passes")

	// Corrupt message.

	_, err = keyPair.VerifyString(nil, sig, append(msg, []byte("corruption")...))
	require.NotNil(t, err, "Signature for corrupt message unexpectedly passes")

	// Signature with different key.

	keyPair2, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	sig2, _, err := keyPair2.SignToString(msg)
	require.NoError(t, err)

	_, err = keyPair.VerifyString(nil, sig2, msg)
	require.NotNil(t, err, "Signature with different key unexpectedly passes")

	// Append different signature.

	_, err = keyPair.VerifyString(nil, sig+sig2, msg)
	require.NotNil(t, err, "Signature with appended different signature unexpectedly passes")

	// Prepend invalid signature.

	_, err = keyPair.VerifyString(nil, sig2+sig, msg)
	require.NotNil(t, err, "Signature with prepended invalid signature unexpectedly passes")
}

// Test that VerifyBytes accepts the output of SignToBytes.
func TestVerifyBytesAccept(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	msg := []byte("test message")
	sig := keyPair.Private.Sign(msg)
	require.True(t, keyPair.Public.Verify(msg, sig), kbcrypto.VerificationError{})
}

// Test that VerifyBytes rejects various types of bad signatures.
func TestVerifyBytesReject(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	msg := []byte("test message")
	sig := keyPair.Private.Sign(msg)

	// Corrupt signature.

	var corruptSig kbcrypto.NaclSignature
	copy(corruptSig[:], sig[:])
	corruptSig[0] = ^sig[0]
	require.False(t, keyPair.Public.Verify(msg, corruptSig), "Corrupt signature unexpectedly passes")

	// Corrupt message.

	corruptMsg := msg
	corruptMsg = append(corruptMsg, []byte("corruption")...)
	require.False(t, keyPair.Public.Verify(corruptMsg, sig), "Signature for corrupt message unexpectedly passes")

	// Signature with different key.

	keyPair2, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	sig2 := keyPair2.Private.Sign(msg)
	require.False(t, keyPair.Public.Verify(msg, sig2), "Signature with different key unexpectedly passes")
}

func TestNaclEncryptEphemeral(t *testing.T) {
	keyPair, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)
	msg := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	ctext, err := keyPair.EncryptToString(msg, nil)
	require.NoError(t, err,
		"encrypt error: %s", err)
	out, kid, err := keyPair.DecryptFromString(ctext)
	require.NoError(t, err,
		"decrypt error: %s", err)
	require.True(t, FastByteArrayEq(out, msg), "Message mismatch: %s != %s", msg, out)
	require.False(t, kid.Equal(keyPair.GetKID()), "KID should be an ephemeral key, not ours")
}

func TestNaclEncryptKnown(t *testing.T) {
	recvr, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)
	sender, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)
	msg := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	ctext, err := recvr.EncryptToString(msg, &sender)
	require.NoError(t, err)
	out, kid, err := recvr.DecryptFromString(ctext)
	require.NoError(t, err)
	require.True(t, FastByteArrayEq(out, msg), "Message mismatch: %s != %s", msg, out)
	require.False(t, kid.NotEqual(sender.GetKID()), "KID mismatch for sender")
}

func TestNaclDecryptFromIced(t *testing.T) {
	seed := "b26ba6f6865b28f9332620c73c2984e2d2a8a83ef5eb59ca47d3b70cfa9f222f"
	ctext := "g6Rib2R5hapjaXBoZXJ0ZXh0xEw2dXZRKyUI5wbSfQGSv61xVIl/cpD8hFN+Gsc5LGEtuXmGG1+1rUFv4QWizfLgqhywaitotmApYJv07zFTUT5sxOU+i2er43XQkkwmqGVuY190eXBlIaVub25jZcQY/rYiRGjPmmxurm5PMlhJuJwP9jk7UJIFrHJlY2VpdmVyX2tlecQjASHyQFIJdlHbnV1oT3MKne5ob7Rmf0emMciNbkD1IyfCKgqqc2VuZGVyX2tlecQjASFKiKO16sYJaloJ4URJM+pL6BSYJcz8M/Za2MSrKCvqawqjdGFnzQIDp3ZlcnNpb24B"
	plaintext := []byte("Man hands on misery to man. It deepens like a coastal shelf.")
	seedBytes, err := hex.DecodeString(seed)
	require.NoError(t, err)
	var secret [32]byte
	copy(secret[:], seedBytes)
	key, err := MakeNaclDHKeyPairFromSecret(secret)
	require.NoError(t, err)

	out, _, err := key.DecryptFromString(ctext)
	require.NoError(t, err)

	require.True(t, FastByteArrayEq(out, plaintext), "failed to match plaintext")
}

// In V2, Nacl sigs are prefixed....
func TestNaclPrefixedSigs(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	t.Logf("keyPair: Public: %+v, Private: %+v", keyPair.Public, keyPair.Private)

	msg := []byte("test message")

	sig, err := keyPair.SignV2(msg, kbcrypto.SignaturePrefixChatMBv1)
	require.NoError(t, err)

	_, err = sig.Verify()
	require.NoError(t, err)

	sig.Version = 1
	_, err = sig.Verify()
	require.Error(t, err,
		"expected an error after we jiggled the version to 1")
	if _, ok := err.(kbcrypto.VerificationError); !ok {
		require.True(t, ok,
			"expected a VerificationError")
	}

	sig.Version = 2
	sig.Prefix = kbcrypto.SignaturePrefixKBFS
	_, err = sig.Verify()
	require.Error(t, err,
		"expected an error after we jiggled the prefix to the wrong one")
	if _, ok := err.(kbcrypto.VerificationError); !ok {
		require.True(t, ok,
			"expected a VerificationError")
	}

	_, err = keyPair.SignV2(msg, kbcrypto.SignaturePrefix("a\x00b"))
	require.Error(t, err,
		"expected a BadSignaturePrefixError")
	if _, ok := err.(kbcrypto.BadSignaturePrefixError); !ok {
		require.True(t, ok,
			"expected a BadSignaturePrefixError")
	}
	_, err = keyPair.SignV2(msg, kbcrypto.SignaturePrefix(""))
	require.Error(t, err,
		"expected a BadSignaturePrefixError")
	if _, ok := err.(kbcrypto.BadSignaturePrefixError); !ok {
		require.True(t, ok,
			"expected a BadSignaturePrefixError")
	}
}

func TestNaclBadPrefix(t *testing.T) {
	keyPair, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	t.Logf("keyPair: Public: %+v, Private: %+v", keyPair.Public, keyPair.Private)

	msg := []byte("test message")

	sig, err := keyPair.Sign(append([]byte("AA\x00"), msg...))
	require.NoError(t, err)
	sig.Version = 2
	sig.Prefix = kbcrypto.SignaturePrefix("AA")
	sig.Payload = msg
	_, err = sig.Verify()
	require.Error(t, err,
		"expected a signature verification error")
}

func TestDeriveSymmetricKeyFromAsymmetricTooShort(t *testing.T) {
	key1 := generateNaclDHKeyPrivate(t)
	_, err := deriveSymmetricKeyFromAsymmetric(key1, EncryptionReason("x"))
	require.Error(t, err, "should error with short reason")
	require.Contains(t, err.Error(), "must be at least 8 bytes")
}

func TestDeriveSymmetricKeyFromAsymmetricDifferentEquality(t *testing.T) {
	key1 := generateNaclDHKeyPrivate(t)

	key2, err := deriveSymmetricKeyFromAsymmetric(key1, EncryptionReasonChatLocalStorage)
	require.NoError(t, err)

	key2_2, err := deriveSymmetricKeyFromAsymmetric(key1, EncryptionReasonChatLocalStorage)
	require.NoError(t, err)

	key3, err := deriveSymmetricKeyFromAsymmetric(key1, EncryptionReasonChatMessage)
	require.NoError(t, err)

	require.NotEqual(t, key1, key2, "derived key must be different from original")
	require.NotEqual(t, key2, key3, "derived keys must differ")
	require.Equal(t, key2, key2_2, "two derivations must be equivalent")
}

func TestDeriveSymmetricKeyFromAsymmetricKnown(t *testing.T) {
	bs, err := hex.DecodeString(
		"aaba52a997cfa11b704c7272e986ad337c8b327baa4265fb024147c97e7b672f")
	require.NoError(t, err)
	var key1 NaclDHKeyPrivate
	require.Equal(t, NaclSecretBoxKeySize, copy(key1[:], bs))

	key2, err := deriveSymmetricKeyFromAsymmetric(key1, EncryptionReason("testing-testing"))
	require.NoError(t, err)

	expected := "a637302de8593ca06d652c3dc8df15ae5eecc89f25718a367f24b28decaa916e"
	require.Equal(t, expected, hex.EncodeToString(key2[:]))
}

func TestDeriveSymmetricKeyTooShort(t *testing.T) {
	key1 := generateNaclSecretboxKey(t)
	_, err := DeriveSymmetricKey(key1, EncryptionReason("x"))
	require.Error(t, err, "should error with short reason")
	require.Contains(t, err.Error(), "must be at least 8 bytes")
}

func TestDeriveSymmetricKeyDifferentEquality(t *testing.T) {
	key1 := generateNaclSecretboxKey(t)

	key2, err := DeriveSymmetricKey(key1, EncryptionReasonChatLocalStorage)
	require.NoError(t, err)

	key2_2, err := DeriveSymmetricKey(key1, EncryptionReasonChatLocalStorage)
	require.NoError(t, err)

	key3, err := DeriveSymmetricKey(key1, EncryptionReasonChatMessage)
	require.NoError(t, err)

	require.NotEqual(t, key1, key2, "derived key must be different from original")
	require.NotEqual(t, key2, key3, "derived keys must differ")
	require.Equal(t, key2, key2_2, "two derivations must be equivalent")
}

func TestDeriveSymmetricKeyKnown(t *testing.T) {
	bs, err := hex.DecodeString(
		"aaba52a997cfa11b704c7272e986ad337c8b327baa4265fb024147c97e7b672f")
	require.NoError(t, err)
	var key1 NaclSecretBoxKey
	require.Equal(t, NaclSecretBoxKeySize, copy(key1[:], bs))

	key2, err := DeriveSymmetricKey(key1, EncryptionReason("testing-testing"))
	require.NoError(t, err)

	expected := "b72ed915c99394c24fc609f9eb794e032580d99c5dbb4f3505f8a6fc8fc6b22b"
	require.Equal(t, expected, hex.EncodeToString(key2[:]))
}

func generateNaclDHKeyPrivate(t *testing.T) NaclDHKeyPrivate {
	keyPair, err := GenerateNaclDHKeyPair()
	require.NoError(t, err, "generating key")
	return *keyPair.Private
}

func generateNaclSecretboxKey(t *testing.T) NaclSecretBoxKey {
	return NaclSecretBoxKey(generateNaclDHKeyPrivate(t))
}
