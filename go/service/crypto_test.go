package service

import (
	"errors"
	"testing"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Test that CryptoHandler.SignED25519() signs the given message with
// the device signing key, and that the signature is verifiable by the
// returned public key.
//
// (For general tests that valid signatures are accepted and invalid
// signatures are rejected, see naclwrap_test.go.)
func TestCryptoSignED25519(t *testing.T) {
	h := NewCryptoHandler(nil)

	kp, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	h.getSecretKeyFn = func(_ libkb.SecretKeyType, _ int, _ string) (libkb.GenericKey, error) {
		return kp, nil
	}

	msg := []byte("test message")
	ret, err := h.SignED25519(keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}

	publicKey := libkb.NaclSigningKeyPublic(ret.PublicKey)
	if publicKey != kp.Public {
		t.Error("unexpected value of publicKey")
	}

	if !publicKey.Verify(msg, (*libkb.NaclSignature)(&ret.Sig)) {
		t.Error(libkb.VerificationError{})
	}
}

// Test that CryptoHandler.SignED25519() returns an error if the wrong
// type of key is returned as the signing key.
func TestCryptoSignED25519WrongSigningKey(t *testing.T) {
	h := NewCryptoHandler(nil)

	kp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	h.getSecretKeyFn = func(_ libkb.SecretKeyType, _ int, _ string) (libkb.GenericKey, error) {
		return kp, nil
	}

	_, err = h.SignED25519(keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})

	expectedErr := libkb.KeyCannotSignError{}
	if err != expectedErr {
		t.Errorf("expected %v, got %v", expectedErr, err)
	}
}

// Test that CryptoHandler.SignED25519() propagates any error
// encountered when getting the device signing key.
func TestCryptoSignED25519NoSigningKey(t *testing.T) {
	h := NewCryptoHandler(nil)

	expectedErr := errors.New("Test error")
	h.getSecretKeyFn = func(_ libkb.SecretKeyType, _ int, _ string) (libkb.GenericKey, error) {
		return nil, expectedErr
	}

	_, err := h.SignED25519(keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})

	if err != expectedErr {
		t.Errorf("expected %v, got %v", expectedErr, err)
	}
}

// Test that CryptoHandler.UnboxTLFCryptKeyClientHalf() decrypts a
// boxed TLFCryptKeyClientHalf correctly.
func TestCryptoUnboxTLFCryptKeyClientHalf(t *testing.T) {
	h := NewCryptoHandler(nil)

	kp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	peerKp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	h.getSecretKeyFn = func(_ libkb.SecretKeyType, _ int, _ string) (libkb.GenericKey, error) {
		return kp, nil
	}

	expectedData := keybase1.TLFCryptKeyClientHalf{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	peersPublicKey := keybase1.BoxPublicKey(peerKp.Public)

	encryptedData := box.Seal(nil, expectedData[:], &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(peerKp.Private))

	data, err := h.UnboxTLFCryptKeyClientHalf(keybase1.UnboxTLFCryptKeyClientHalfArg{
		EncryptedData:  encryptedData,
		Nonce:          nonce,
		PeersPublicKey: peersPublicKey,
	})

	if err != nil {
		t.Fatal(err)
	}

	if data != expectedData {
		t.Errorf("expected %s, got %s", expectedData, data)
	}
}
