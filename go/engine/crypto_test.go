package engine

import (
	"testing"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Test that SignED25519() signs the given message with the device
// signing key, and that the signature is verifiable by the returned
// public key.
//
// (For general tests that valid signatures are accepted and invalid
// signatures are rejected, see naclwrap_test.go.)
func TestCryptoSignED25519(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")
	secretUI := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	msg := []byte("test message")
	ret, err := SignED25519(tc.G, secretUI, keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}

	publicKey := libkb.NaclSigningKeyPublic(ret.PublicKey)
	if !publicKey.Verify(msg, (*libkb.NaclSignature)(&ret.Sig)) {
		t.Error(libkb.VerificationError{})
	}
}

// Test that CryptoHandler.SignED25519() propagates any error
// encountered when getting the device signing key.
func TestCryptoSignED25519NoSigningKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	secretUI := &libkb.TestSecretUI{}
	_, err := SignED25519(tc.G, secretUI, keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})

	if _, ok := err.(libkb.SelfNotFoundError); !ok {
		t.Errorf("expected SelfNotFoundError, got %v", err)
	}
}

func BenchmarkCryptoSignED25519(b *testing.B) {
	tc := SetupEngineTest(b, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")
	secretUI := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	for i := 0; i < b.N; i++ {
		msg := []byte("test message")
		_, err := SignED25519(tc.G, secretUI, keybase1.SignED25519Arg{
			Msg: msg,
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Test that CryptoHandler.UnboxBytes32() decrypts a boxed 32-byte
// array correctly.
func TestCryptoUnboxBytes32(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")
	secretUI := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	key, err := getMySecretKey(
		tc.G, secretUI, libkb.DeviceEncryptionKeyType, "test")
	if err != nil {
		t.Fatal(err)
	}
	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		t.Fatalf("unexpected key %v", key)
	}

	peerKp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	expectedBytes32 := keybase1.Bytes32{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	peersPublicKey := keybase1.BoxPublicKey(peerKp.Public)

	encryptedData := box.Seal(nil, expectedBytes32[:], &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(peerKp.Private))

	var encryptedBytes32 keybase1.EncryptedBytes32
	if len(encryptedBytes32) != len(encryptedData) {
		t.Fatalf("Expected %d bytes, got %d", len(encryptedBytes32), len(encryptedData))
	}

	copy(encryptedBytes32[:], encryptedData)

	bytes32, err := UnboxBytes32(tc.G, secretUI, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedBytes32,
		Nonce:            nonce,
		PeersPublicKey:   peersPublicKey,
	})

	if err != nil {
		t.Fatal(err)
	}

	if bytes32 != expectedBytes32 {
		t.Errorf("expected %s, got %s", expectedBytes32, bytes32)
	}
}

// Test that CryptoHandler.UnboxBytes32() propagates any decryption
// errors correctly.
//
// For now, we're assuming that nacl/box works correctly (i.e., we're
// not testing the ways in which decryption can fail).
func TestCryptoUnboxBytes32DecryptionError(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")
	secretUI := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	_, err := UnboxBytes32(tc.G, secretUI, keybase1.UnboxBytes32Arg{})
	if err != (libkb.DecryptionError{}) {
		t.Errorf("expected nil, got %v", err)
	}
}

// Test that CryptoHandler.UnboxBytes32() propagates any error
// encountered when getting the device encryption key.
func TestCryptoUnboxBytes32NoEncryptionKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	secretUI := &libkb.TestSecretUI{}
	_, err := UnboxBytes32(tc.G, secretUI, keybase1.UnboxBytes32Arg{})

	if _, ok := err.(libkb.SelfNotFoundError); !ok {
		t.Errorf("expected SelfNotFoundError, got %v", err)
	}
}
