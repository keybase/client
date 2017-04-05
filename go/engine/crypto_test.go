// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"fmt"
	"runtime/debug"
	"testing"

	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}

	msg := []byte("test message")
	ret, err := SignED25519(context.TODO(), tc.G, f, keybase1.SignED25519Arg{
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

// Test that SignToString() signs the given message with the device
// signing key and that the signature is verifiable and contains the message.
func TestCryptoSignToString(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}

	msg := []byte("test message")
	signature, err := SignToString(context.TODO(), tc.G, f, keybase1.SignToStringArg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}

	_, msg2, _, err := libkb.NaclVerifyAndExtract(signature)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg, msg2) {
		t.Fatal(fmt.Errorf("message mismatch, expected: %s, got: %s",
			string(msg), string(msg2)))
	}
}

// Test that CryptoHandler.SignED25519() propagates any error
// encountered when getting the device signing key.
func TestCryptoSignED25519NoSigningKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{}
	}
	_, err := SignED25519(context.TODO(), tc.G, f, keybase1.SignED25519Arg{
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
	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		msg := []byte("test message")
		_, err := SignED25519(context.TODO(), tc.G, f, keybase1.SignED25519Arg{
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
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}

	key, err := GetMySecretKey(
		context.TODO(),
		tc.G, f, libkb.DeviceEncryptionKeyType, "test")
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

	bytes32, err := UnboxBytes32(context.TODO(), tc.G, f, keybase1.UnboxBytes32Arg{
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

	// also test UnboxBytes32Any:
	arg := keybase1.UnboxBytes32AnyArg{
		Bundles: []keybase1.CiphertextBundle{
			{Kid: kp.GetKID(), Ciphertext: encryptedBytes32, Nonce: nonce, PublicKey: peersPublicKey},
		},
	}
	res, err := UnboxBytes32Any(context.TODO(), tc.G, f, arg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Plaintext != expectedBytes32 {
		t.Errorf("UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	}
	if res.Kid.IsNil() {
		t.Errorf("UnboxBytes32Any kid is nil")
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
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}

	_, err := UnboxBytes32(context.TODO(), tc.G, f, keybase1.UnboxBytes32Arg{})
	if _, ok := err.(libkb.DecryptionError); !ok {
		t.Errorf("expected libkb.DecryptionError, got %T", err)
	}
}

// Test that CryptoHandler.UnboxBytes32() propagates any error
// encountered when getting the device encryption key.
func TestCryptoUnboxBytes32NoEncryptionKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{}
	}
	_, err := UnboxBytes32(context.TODO(), tc.G, f, keybase1.UnboxBytes32Arg{})

	if _, ok := err.(libkb.SelfNotFoundError); !ok {
		t.Errorf("expected SelfNotFoundError, got %v", err)
	}
}

func cachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) (key libkb.GenericKey, err error) {
	return tc.G.ActiveDevice.KeyByType(ktype)
}

func assertCachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) {
	skey, err := cachedSecretKey(tc, ktype)
	if err != nil {
		debug.PrintStack()
		tc.T.Fatalf("error getting cached secret key: %s", err)
	}
	if skey == nil {
		tc.T.Fatalf("expected cached key, got nil")
	}
}

func assertNotCachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) {
	skey, err := cachedSecretKey(tc, ktype)
	if err == nil {
		tc.T.Fatal("expected err getting cached secret key, got nil")
	}
	if _, notFound := err.(libkb.NotFoundError); !notFound {
		tc.T.Fatalf("expected not found error, got %s (%T)", err, err)
	}
	if skey != nil {
		tc.T.Fatalf("expected nil cached key, got %v", skey)
	}
}

// TestCachedSecretKey tests that secret device keys are cached
// properly.
func TestCachedSecretKey(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	assertCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)

	Logout(tc)

	assertNotCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertNotCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)

	u.LoginOrBust(tc)

	assertCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)

	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}

	msg := []byte("test message")
	_, err := SignED25519(context.TODO(), tc.G, f, keybase1.SignED25519Arg{
		Msg: msg,
	})
	if err != nil {
		t.Fatal(err)
	}

	assertCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)

	Logout(tc)

	assertNotCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertNotCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)

	u.LoginOrBust(tc)

	assertCachedSecretKey(tc, libkb.DeviceSigningKeyType)
	assertCachedSecretKey(tc, libkb.DeviceEncryptionKeyType)
}

func TestCryptoUnboxBytes32AnyPaper(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "fu")

	// create a paper key and cache it
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: u.NewSecretUI(),
	}
	peng := NewPaperKey(tc.G)
	if err := RunEngine(peng, ctx); err != nil {
		t.Fatal(err)
	}
	err := tc.G.LoginState().Account(func(a *libkb.Account) {
		a.SetUnlockedPaperKey(peng.SigKey(), peng.EncKey())
	}, "TestCryptoUnboxBytes32AnyPaper")

	key := peng.EncKey()
	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok {
		t.Fatalf("paper enc key type: %T, expected libkb.NaclDHKeyPair", key)
	}
	if kp.Private == nil {
		t.Fatalf("paper enc key has nil private key")
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

	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}

	_, err = UnboxBytes32(context.TODO(), tc.G, f, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedBytes32,
		Nonce:            nonce,
		PeersPublicKey:   peersPublicKey,
	})

	// this should fail
	if err == nil {
		t.Fatal("UnboxBytes32 worked with paper key encrypted data")
	}
	if _, ok := err.(libkb.DecryptionError); !ok {
		t.Fatalf("error %T, expected libkb.DecryptionError", err)
	}

	// this should work
	arg := keybase1.UnboxBytes32AnyArg{
		Bundles: []keybase1.CiphertextBundle{
			{Kid: kp.GetKID(), Ciphertext: encryptedBytes32, Nonce: nonce, PublicKey: peersPublicKey},
		},
		PromptPaper: true,
	}
	res, err := UnboxBytes32Any(context.TODO(), tc.G, f, arg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Plaintext != expectedBytes32 {
		t.Errorf("UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	}
	if res.Kid.IsNil() {
		t.Errorf("UnboxBytes32Any kid is nil")
	}

	// clear the paper key cache to test getting a paper key via UI
	err = tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearCachedSecretKeys()
	}, "TestCryptoUnboxBytes32AnyPaper")
	if err != nil {
		t.Fatal(err)
	}

	f = func() libkb.SecretUI {
		// set the passphrase in the secretUI to the paper key
		secretUI := u.NewSecretUI()
		secretUI.Passphrase = peng.Passphrase()
		return secretUI
	}

	res, err = UnboxBytes32Any(context.TODO(), tc.G, f, arg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Plaintext != expectedBytes32 {
		t.Errorf("UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	}
	if res.Kid.IsNil() {
		t.Errorf("UnboxBytes32Any kid is nil")
	}
}
