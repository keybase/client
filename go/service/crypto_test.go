package service

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
)

// Test that CryptoSignED25519 yields a signature that the
// corresponding key can verify.
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

	_, err = h.SignED25519(keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})
	if err != nil {
		t.Fatal(err)
	}
}
