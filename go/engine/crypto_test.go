// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"context"
	"fmt"
	"runtime/debug"
	"testing"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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

	CreateAndSignupFakeUser(tc, "fu")

	msg := []byte("test message")
	ret, err := SignED25519(context.TODO(), tc.G, keybase1.SignED25519Arg{
		Msg: msg,
	})
	require.NoError(t, err)

	publicKey := kbcrypto.NaclSigningKeyPublic(ret.PublicKey)
	require.True(t, publicKey.Verify(msg, kbcrypto.NaclSignature(ret.Sig)), kbcrypto.VerificationError{})
}

// Test that SignToString() signs the given message with the device
// signing key and that the signature is verifiable and contains the message.
func TestCryptoSignToString(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "fu")

	msg := []byte("test message")
	signature, err := SignToString(context.TODO(), tc.G, keybase1.SignToStringArg{
		Msg: msg,
	})
	require.NoError(t, err)

	_, msg2, _, err := kbcrypto.NaclVerifyAndExtract(signature)
	require.NoError(t, err)
	require.True(t, bytes.Equal(msg, msg2),
		fmt.Errorf("message mismatch, expected: %s, got: %s",
			string(msg), string(msg2)))
}

// Test that CryptoHandler.SignED25519() propagates any error
// encountered when getting the device signing key.
func TestCryptoSignED25519NoSigningKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	_, err := SignED25519(context.TODO(), tc.G, keybase1.SignED25519Arg{
		Msg: []byte("test message"),
	})

	_, ok := err.(libkb.LoginRequiredError)
	require.True(t, ok, "expected LoginRequiredError, got %v", err)
}

func BenchmarkCryptoSignED25519(b *testing.B) {
	tc := SetupEngineTest(b, "crypto")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "fu")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		msg := []byte("test message")
		_, err := SignED25519(context.TODO(), tc.G, keybase1.SignED25519Arg{
			Msg: msg,
		})
		require.NoError(b, err)
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
		tc.G, libkb.DeviceEncryptionKeyType, "test")
	require.NoError(t, err)
	kp, ok := key.(libkb.NaclDHKeyPair)
	require.False(t, !ok || kp.Private == nil,
		"unexpected key %v", key)

	peerKp, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)

	expectedBytes32 := keybase1.Bytes32{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	peersPublicKey := keybase1.BoxPublicKey(peerKp.Public)

	encryptedData := box.Seal(nil, expectedBytes32[:], &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(peerKp.Private))

	var encryptedBytes32 keybase1.EncryptedBytes32
	require.Len(t, encryptedBytes32, len(encryptedData), "Expected %d bytes, got %d", len(encryptedBytes32), len(encryptedData))

	copy(encryptedBytes32[:], encryptedData)

	bytes32, err := UnboxBytes32(context.TODO(), tc.G, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedBytes32,
		Nonce:            nonce,
		PeersPublicKey:   peersPublicKey,
	})
	require.NoError(t, err)

	require.Equal(t, expectedBytes32, bytes32, "expected %s, got %s", expectedBytes32, bytes32)

	// also test UnboxBytes32Any:
	arg := keybase1.UnboxBytes32AnyArg{
		Bundles: []keybase1.CiphertextBundle{
			{Kid: kp.GetKID(), Ciphertext: encryptedBytes32, Nonce: nonce, PublicKey: peersPublicKey},
		},
	}
	res, err := UnboxBytes32Any(NewMetaContextForTest(tc), f, arg)
	require.NoError(t, err)
	require.Equal(t, expectedBytes32, res.Plaintext, "UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	require.False(t, res.Kid.IsNil(), "UnboxBytes32Any kid is nil")
}

// Test that CryptoHandler.UnboxBytes32() propagates any decryption
// errors correctly.
//
// For now, we're assuming that nacl/box works correctly (i.e., we're
// not testing the ways in which decryption can fail).
func TestCryptoUnboxBytes32DecryptionError(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "fu")

	_, err := UnboxBytes32(context.TODO(), tc.G, keybase1.UnboxBytes32Arg{})
	_, ok := err.(libkb.DecryptionError)
	require.True(t, ok, "expected libkb.DecryptionError, got %T", err)
}

// Test that CryptoHandler.UnboxBytes32() propagates any error
// encountered when getting the device encryption key.
func TestCryptoUnboxBytes32NoEncryptionKey(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	_, err := UnboxBytes32(context.TODO(), tc.G, keybase1.UnboxBytes32Arg{})

	_, ok := err.(libkb.LoginRequiredError)
	require.True(t, ok, "expected LoginRequiredError, got %v", err)
}

func cachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) (key libkb.GenericKey, err error) {
	return tc.G.ActiveDevice.KeyByType(ktype)
}

func assertCachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) {
	skey, err := cachedSecretKey(tc, ktype)
	if err != nil {
		debug.PrintStack()
		require.FailNow(tc.T, fmt.Sprintf("error getting cached secret key: %s", err))
	}
	require.NotNil(tc.T, skey,
		"expected cached key, got nil")
}

func assertNotCachedSecretKey(tc libkb.TestContext, ktype libkb.SecretKeyType) {
	skey, err := cachedSecretKey(tc, ktype)
	require.Error(tc.T, err,
		"expected err getting cached secret key, got nil")
	if _, notFound := err.(libkb.NotFoundError); !notFound {
		require.True(tc.T, notFound,
			"expected not found error, got %s (%T)", err, err)
	}
	require.Nil(tc.T, skey,
		"expected nil cached key, got %v", skey)
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

	msg := []byte("test message")
	_, err := SignED25519(context.TODO(), tc.G, keybase1.SignED25519Arg{
		Msg: msg,
	})
	require.NoError(t, err)

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
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: u.NewSecretUI(),
	}
	peng := NewPaperKey(tc.G)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, peng); err != nil {
		require.NoError(t, err)
	}

	m.ActiveDevice().CacheProvisioningKey(m, libkb.NewDeviceWithKeysOnly(peng.SigKey(), peng.EncKey(), libkb.KeychainModeNone))

	key := peng.EncKey()
	kp, ok := key.(libkb.NaclDHKeyPair)
	require.True(t, ok,
		"paper enc key type: %T, expected libkb.NaclDHKeyPair", key)
	require.NotNil(t, kp.Private,
		"paper enc key has nil private key")

	peerKp, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)

	expectedBytes32 := keybase1.Bytes32{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	peersPublicKey := keybase1.BoxPublicKey(peerKp.Public)

	encryptedData := box.Seal(nil, expectedBytes32[:], &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(peerKp.Private))

	var encryptedBytes32 keybase1.EncryptedBytes32
	require.Len(t, encryptedBytes32, len(encryptedData), "Expected %d bytes, got %d", len(encryptedBytes32), len(encryptedData))

	copy(encryptedBytes32[:], encryptedData)

	f := func() libkb.SecretUI {
		return u.NewSecretUI()
	}

	_, err = UnboxBytes32(context.TODO(), tc.G, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedBytes32,
		Nonce:            nonce,
		PeersPublicKey:   peersPublicKey,
	})

	// this should fail
	require.Error(t, err,
		"UnboxBytes32 worked with paper key encrypted data")
	if _, ok := err.(libkb.DecryptionError); !ok {
		require.True(t, ok,
			"error %T, expected libkb.DecryptionError", err)
	}

	// this should work
	arg := keybase1.UnboxBytes32AnyArg{
		Bundles: []keybase1.CiphertextBundle{
			{Kid: kp.GetKID(), Ciphertext: encryptedBytes32, Nonce: nonce, PublicKey: peersPublicKey},
		},
		PromptPaper: true,
	}
	res, err := UnboxBytes32Any(NewMetaContextForTest(tc), f, arg)
	require.NoError(t, err)
	require.Equal(t, expectedBytes32, res.Plaintext, "UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	require.False(t, res.Kid.IsNil(), "UnboxBytes32Any kid is nil")

	// clear the paper key cache to test getting a paper key via UI
	clearCaches(tc.G)

	f = func() libkb.SecretUI {
		// set the passphrase in the secretUI to the paper key
		secretUI := u.NewSecretUI()
		secretUI.Passphrase = peng.Passphrase()
		return secretUI
	}

	res, err = UnboxBytes32Any(NewMetaContextForTest(tc), f, arg)
	require.NoError(t, err)
	require.Equal(t, expectedBytes32, res.Plaintext, "UnboxBytes32Any plaintext: %x, expected %x", res.Plaintext, expectedBytes32)
	require.False(t, res.Kid.IsNil(), "UnboxBytes32Any kid is nil")
}
