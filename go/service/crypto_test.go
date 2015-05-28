package service

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
)

// Test that CryptoSignED25519 signs the given message with the device
// signing key, and that the signature is verifiable by the returned
// public key.
//
// (For general tests that valid signatures are accepted and invalid
// signatures are rejected, see naclwrap_test.go.)
func TestCryptoSignED25519(t *testing.T) {
	h := NewCryptoHandler(nil)

	kp, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	h.getDeviceSigningKeyFn = func(_ int, _ string) (libkb.GenericKey, error) {
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

// Test that CryptoSignED25519 propagates any error encountered when
// getting the device signing key.
func TestCryptoSignED25519NoSigningKey(t *testing.T) {
	h := NewCryptoHandler(nil)

	expectedErr := errors.New("Test error")
	h.getDeviceSigningKeyFn = func(_ int, _ string) (libkb.GenericKey, error) {
		return nil, expectedErr
	}

	_, err := h.SignED25519(keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})
	if err != expectedErr {
		t.Errorf("expected %v, got %v", expectedErr, err)
	}
}
