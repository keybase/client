// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

type FakeCryptoClient struct {
	Local     CryptoLocal
	readyChan chan<- struct{}
	goChan    <-chan struct{}
}

func NewFakeCryptoClient(config Config, signingKey kbfscrypto.SigningKey,
	cryptPrivateKey kbfscrypto.CryptPrivateKey, readyChan chan<- struct{},
	goChan <-chan struct{}) *FakeCryptoClient {
	return &FakeCryptoClient{
		Local: NewCryptoLocal(
			config.Codec(), signingKey, cryptPrivateKey),
		readyChan: readyChan,
		goChan:    goChan,
	}
}

func (fc FakeCryptoClient) maybeWaitOnChannel(ctx context.Context) error {
	if fc.readyChan == nil {
		return nil
	}

	// say we're ready, and wait for a signal to proceed or a
	// cancellation.
	fc.readyChan <- struct{}{}
	select {
	case <-fc.goChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (fc FakeCryptoClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.crypto.signED25519":
		if err := fc.maybeWaitOnChannel(ctx); err != nil {
			return err
		}
		arg := args.([]interface{})[0].(keybase1.SignED25519Arg)
		sigInfo, err := fc.Local.Sign(context.Background(), arg.Msg)
		if err != nil {
			return err
		}
		sigRes := res.(*keybase1.ED25519SignatureInfo)
		// Normally, we'd have to validate all the parameters
		// in sigInfo, but since this is used in tests only,
		// there's no need.
		var ed25519Signature keybase1.ED25519Signature
		copy(ed25519Signature[:], sigInfo.Signature)
		publicKey :=
			libkb.KIDToNaclSigningKeyPublic(sigInfo.VerifyingKey.KID().ToBytes())
		*sigRes = keybase1.ED25519SignatureInfo{
			Sig:       ed25519Signature,
			PublicKey: keybase1.ED25519PublicKey(*publicKey),
		}
		return nil

	case "keybase.1.crypto.unboxBytes32":
		if err := fc.maybeWaitOnChannel(ctx); err != nil {
			return err
		}
		arg := args.([]interface{})[0].(keybase1.UnboxBytes32Arg)
		publicKey := kbfscrypto.MakeTLFEphemeralPublicKey(
			arg.PeersPublicKey)
		encryptedClientHalf := EncryptedTLFCryptKeyClientHalf{
			Version:       EncryptionSecretbox,
			EncryptedData: arg.EncryptedBytes32[:],
			Nonce:         arg.Nonce[:],
		}
		clientHalf, err := fc.Local.DecryptTLFCryptKeyClientHalf(
			context.Background(), publicKey, encryptedClientHalf)
		if err != nil {
			return err
		}
		res := res.(*keybase1.Bytes32)
		*res = clientHalf.Data()
		return nil

	case "keybase.1.crypto.unboxBytes32Any":
		if err := fc.maybeWaitOnChannel(ctx); err != nil {
			return err
		}
		arg := args.([]interface{})[0].(keybase1.UnboxBytes32AnyArg)
		keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0, len(arg.Bundles))
		for _, k := range arg.Bundles {
			ePublicKey := kbfscrypto.MakeTLFEphemeralPublicKey(
				k.PublicKey)
			encryptedClientHalf := EncryptedTLFCryptKeyClientHalf{
				Version:       EncryptionSecretbox,
				EncryptedData: make([]byte, len(k.Ciphertext)),
				Nonce:         make([]byte, len(k.Nonce)),
			}
			copy(encryptedClientHalf.EncryptedData, k.Ciphertext[:])
			copy(encryptedClientHalf.Nonce, k.Nonce[:])
			keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
				EPubKey:    ePublicKey,
				ClientHalf: encryptedClientHalf,
				PubKey:     kbfscrypto.MakeCryptPublicKey(k.Kid),
			})
		}
		clientHalf, index, err := fc.Local.DecryptTLFCryptKeyClientHalfAny(
			context.Background(), keys, arg.PromptPaper)
		if err != nil {
			return err
		}
		res := res.(*keybase1.UnboxAnyRes)
		res.Plaintext = clientHalf.Data()
		res.Index = index
		res.Kid = keys[index].PubKey.KID()
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

func (fc FakeCryptoClient) Notify(_ context.Context, s string, args interface{}) error {
	return fmt.Errorf("Unknown notify: %s %v", s, args)
}

func testCryptoClientConfig(t *testing.T) Config {
	config := &ConfigLocal{codec: kbfscodec.NewMsgpack()}
	setTestLogger(config, t)
	return config
}

// Test that signing a message and then verifying it works.
func TestCryptoClientSignAndVerify(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	msg := []byte("message")
	sigInfo, err := c.Sign(context.Background(), msg)
	if err != nil {
		t.Fatal(err)
	}

	err = c.Verify(msg, sigInfo)
	if err != nil {
		t.Error(err)
	}
}

// Test that canceling a signing RPC returns the correct error
func TestCryptoClientSignCanceled(t *testing.T) {
	config := testCryptoClientConfig(t)
	serverConn, conn := rpc.MakeConnectionForTest(t)
	c := newCryptoClientWithClient(config, conn.GetClient())

	f := func(ctx context.Context) error {
		msg := []byte("message")
		_, err := c.Sign(ctx, msg)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

// Test that decrypting an TLF crypt key client half encrypted with
// box.Seal works.
func TestCryptoClientDecryptTLFCryptKeyClientHalfBoxSeal(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	var nonce [24]byte
	err = cryptoRandRead(nonce[:])
	if err != nil {
		t.Fatal(err)
	}

	keypair, err := libkb.ImportKeypairFromKID(cryptPrivateKey.GetPublicKey().KID())
	if err != nil {
		t.Fatal(err)
	}

	dhKeyPair, ok := keypair.(libkb.NaclDHKeyPair)
	if !ok {
		t.Fatal(libkb.KeyCannotEncryptError{})
	}

	clientHalfData := clientHalf.Data()
	ephPrivateKeyData := ephPrivateKey.Data()
	encryptedData := box.Seal(nil, clientHalfData[:], &nonce, (*[32]byte)(&dhKeyPair.Public), &ephPrivateKeyData)
	encryptedClientHalf := EncryptedTLFCryptKeyClientHalf{
		Version:       EncryptionSecretbox,
		Nonce:         nonce[:],
		EncryptedData: encryptedData,
	}

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(
		context.Background(), ephPublicKey, encryptedClientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if clientHalf != decryptedClientHalf {
		t.Error("clientHalf != decryptedClientHalf")
	}
}

// Test that decrypting a TLF crypt key client half encrypted with the
// default method (currently nacl/box) works.
func TestCryptoClientDecryptEncryptedTLFCryptKeyClientHalf(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	// See crypto_common_test.go for tests that this actually
	// performs encryption.
	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if encryptedClientHalf.Version != EncryptionSecretbox {
		t.Fatalf("Unexpected encryption version %d", encryptedClientHalf.Version)
	}

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(
		context.Background(), ephPublicKey, encryptedClientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if clientHalf != decryptedClientHalf {
		t.Error("clientHalf != decryptedClientHalf")
	}
}

// Test that attempting to decrypt an empty set of client keys fails.
func TestCryptoClientDecryptEmptyEncryptedTLFCryptKeyClientHalfAny(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0, 0)

	_, _, err := c.DecryptTLFCryptKeyClientHalfAny(
		context.Background(), keys, false)
	if _, ok := err.(NoKeysError); !ok {
		t.Fatalf("expected NoKeysError. Actual error: %v", err)
	}
}

// Test that when decrypting set of client keys, the first working one
// is used to decrypt.
func TestCryptoClientDecryptEncryptedTLFCryptKeyClientHalfAny(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0, 4)
	clientHalves := make([]kbfscrypto.TLFCryptKeyClientHalf, 0, 4)
	for i := 0; i < 4; i++ {
		_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
		if err != nil {
			t.Fatal(err)
		}

		serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
		if err != nil {
			t.Fatal(err)
		}

		clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
		if err != nil {
			t.Fatal(err)
		}

		// See crypto_common_test.go for tests that this actually
		// performs encryption.
		encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
		if err != nil {
			t.Fatal(err)
		}

		if encryptedClientHalf.Version != EncryptionSecretbox {
			t.Fatalf("Unexpected encryption version %d", encryptedClientHalf.Version)
		}
		keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalf,
			EPubKey:    ephPublicKey,
		})
		clientHalves = append(clientHalves, clientHalf)
	}

	decryptedClientHalf, index, err := c.DecryptTLFCryptKeyClientHalfAny(
		context.Background(), keys, false)
	if err != nil {
		t.Fatal(err)
	}

	if index != 0 {
		t.Errorf("expected first key to work. Actual key index: %d", index)
	}

	if clientHalves[0] != decryptedClientHalf {
		t.Error("clientHalf != decryptedClientHalf")
	}
}

// Test various failure cases for DecryptTLFCryptKeyClientHalfAny and that
// if a working key is present, the decryption succeeds.
func TestCryptoClientDecryptTLFCryptKeyClientHalfAnyFailures(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	// Wrong version.
	encryptedClientHalfWrongVersion := encryptedClientHalf
	encryptedClientHalfWrongVersion.Version++

	// Wrong sizes.
	encryptedClientHalfWrongSize := encryptedClientHalf
	encryptedClientHalfWrongSize.EncryptedData = encryptedClientHalfWrongSize.EncryptedData[:len(encryptedClientHalfWrongSize.EncryptedData)-1]

	encryptedClientHalfWrongNonceSize := encryptedClientHalf
	encryptedClientHalfWrongNonceSize.Nonce = encryptedClientHalfWrongNonceSize.Nonce[:len(encryptedClientHalfWrongNonceSize.Nonce)-1]

	// Corrupt key.
	ephPublicKeyCorruptData := ephPublicKey.Data()
	ephPublicKeyCorruptData[0] = ^ephPublicKeyCorruptData[0]
	ephPublicKeyCorrupt := kbfscrypto.MakeTLFEphemeralPublicKey(
		ephPublicKeyCorruptData)

	// Corrupt data.
	encryptedClientHalfCorruptData := encryptedClientHalf
	encryptedClientHalfCorruptData.EncryptedData = make([]byte, len(encryptedClientHalf.EncryptedData))
	copy(encryptedClientHalfCorruptData.EncryptedData, encryptedClientHalf.EncryptedData)
	encryptedClientHalfCorruptData.EncryptedData[0] = ^encryptedClientHalfCorruptData.EncryptedData[0]

	keys := []EncryptedTLFCryptKeyClientAndEphemeral{
		{
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalfWrongVersion,
			EPubKey:    ephPublicKey,
		}, {
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalfWrongSize,
			EPubKey:    ephPublicKey,
		}, {
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalfWrongNonceSize,
			EPubKey:    ephPublicKey,
		}, {
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalf,
			EPubKey:    ephPublicKeyCorrupt,
		}, {
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalfCorruptData,
			EPubKey:    ephPublicKey,
		}, {
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalf,
			EPubKey:    ephPublicKey,
		},
	}

	_, index, err := c.DecryptTLFCryptKeyClientHalfAny(
		context.Background(), keys, false)
	if err != nil {
		t.Fatal(err)
	}

	if index != len(keys)-1 {
		t.Errorf("expected last key to work. Actual key index: %d", index)
	}
}

// Test various failure cases for DecryptTLFCryptKeyClientHalf.
func TestCryptoClientDecryptTLFCryptKeyClientHalfFailures(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	fc := NewFakeCryptoClient(config, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(config, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	var expectedErr error

	// Wrong version.

	encryptedClientHalfWrongVersion := encryptedClientHalf
	encryptedClientHalfWrongVersion.Version++
	expectedErr = UnknownEncryptionVer{encryptedClientHalfWrongVersion.Version}
	ctx := context.Background()
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongVersion)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Wrong sizes.

	encryptedClientHalfWrongSize := encryptedClientHalf
	encryptedClientHalfWrongSize.EncryptedData = encryptedClientHalfWrongSize.EncryptedData[:len(encryptedClientHalfWrongSize.EncryptedData)-1]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongSize)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	encryptedClientHalfWrongNonceSize := encryptedClientHalf
	encryptedClientHalfWrongNonceSize.Nonce = encryptedClientHalfWrongNonceSize.Nonce[:len(encryptedClientHalfWrongNonceSize.Nonce)-1]
	expectedErr = InvalidNonceError{encryptedClientHalfWrongNonceSize.Nonce}
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongNonceSize)
	if err.Error() != expectedErr.Error() {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt key.

	ephPublicKeyCorruptData := ephPublicKey.Data()
	ephPublicKeyCorruptData[0] = ^ephPublicKeyCorruptData[0]
	ephPublicKeyCorrupt := kbfscrypto.MakeTLFEphemeralPublicKey(
		ephPublicKeyCorruptData)
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKeyCorrupt,
		encryptedClientHalf)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt data.

	encryptedClientHalfCorruptData := encryptedClientHalf
	encryptedClientHalfCorruptData.EncryptedData[0] = ^encryptedClientHalfCorruptData.EncryptedData[0]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfCorruptData)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}
}

// Test that canceling a signing RPC returns the correct error
func TestCryptoClientDecryptTLFCryptKeyClientHalfCanceled(t *testing.T) {
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	config := testCryptoClientConfig(t)
	serverConn, conn := rpc.MakeConnectionForTest(t)
	c := newCryptoClientWithClient(config, conn.GetClient())

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	f := func(ctx context.Context) error {
		_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
			encryptedClientHalf)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}
