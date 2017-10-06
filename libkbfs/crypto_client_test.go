// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

type FakeCryptoClient struct {
	Local     CryptoLocal
	readyChan chan<- struct{}
	goChan    <-chan struct{}
}

func NewFakeCryptoClient(
	codec kbfscodec.Codec, signingKey kbfscrypto.SigningKey,
	cryptPrivateKey kbfscrypto.CryptPrivateKey, readyChan chan<- struct{},
	goChan <-chan struct{}) *FakeCryptoClient {
	return &FakeCryptoClient{
		Local:     NewCryptoLocal(codec, signingKey, cryptPrivateKey),
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
		return errors.WithStack(ctx.Err())
	}
}

func (fc FakeCryptoClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.crypto.signED25519":
		if err := fc.maybeWaitOnChannel(ctx); err != nil {
			return err
		}
		arg := args.([]interface{})[0].(keybase1.SignED25519Arg)
		sigInfo, err := fc.Local.Sign(ctx, arg.Msg)
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
		encryptedClientHalf := kbfscrypto.MakeEncryptedTLFCryptKeyClientHalfForTest(
			EncryptionSecretbox, arg.EncryptedBytes32[:],
			arg.Nonce[:])
		clientHalf, err := fc.Local.DecryptTLFCryptKeyClientHalf(
			ctx, publicKey, encryptedClientHalf)
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
			encryptedClientHalf := kbfscrypto.MakeEncryptedTLFCryptKeyClientHalfForTest(
				EncryptionSecretbox,
				k.Ciphertext[:],
				k.Nonce[:])
			keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
				EPubKey:    ePublicKey,
				ClientHalf: encryptedClientHalf,
				PubKey:     kbfscrypto.MakeCryptPublicKey(k.Kid),
			})
		}
		clientHalf, index, err := fc.Local.DecryptTLFCryptKeyClientHalfAny(
			ctx, keys, arg.PromptPaper)
		if err != nil {
			return err
		}
		res := res.(*keybase1.UnboxAnyRes)
		res.Plaintext = clientHalf.Data()
		res.Index = index
		res.Kid = keys[index].PubKey.KID()
		return nil

	default:
		return errors.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

func (fc FakeCryptoClient) Notify(_ context.Context, s string, args interface{}) error {
	return errors.Errorf("Unknown notify: %s %v", s, args)
}

// Test that signing a message and then verifying it works.
func TestCryptoClientSignAndVerify(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	msg := []byte("message")
	sigInfo, err := c.Sign(context.Background(), msg)
	require.NoError(t, err)

	err = kbfscrypto.Verify(msg, sigInfo)
	require.NoError(t, err)
}

// Test that canceling a signing RPC returns the correct error
func TestCryptoClientSignCanceled(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	serverConn, conn := rpc.MakeConnectionForTest(t)
	c := newCryptoClientWithClient(codec, log, conn.GetClient())

	f := func(ctx context.Context) error {
		msg := []byte("message")
		_, err := c.Sign(ctx, msg)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

// Test that decrypting a TLF crypt key client half encrypted with
// box.Seal works.
func TestCryptoClientDecryptTLFCryptKeyClientHalfBoxSeal(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	ephPublicKey, ephPrivateKey, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

	var nonce [24]byte
	err = kbfscrypto.RandRead(nonce[:])
	require.NoError(t, err)

	keypair, err := libkb.ImportKeypairFromKID(cryptPrivateKey.GetPublicKey().KID())
	require.NoError(t, err)

	dhKeyPair, ok := keypair.(libkb.NaclDHKeyPair)
	require.True(t, ok)

	clientHalfData := clientHalf.Data()
	ephPrivateKeyData := ephPrivateKey.Data()
	encryptedBytes := box.Seal(nil, clientHalfData[:], &nonce, (*[32]byte)(&dhKeyPair.Public), &ephPrivateKeyData)
	encryptedClientHalf := kbfscrypto.MakeEncryptedTLFCryptKeyClientHalfForTest(
		EncryptionSecretbox, encryptedBytes, nonce[:])

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(
		context.Background(), ephPublicKey, encryptedClientHalf)
	require.NoError(t, err)
	require.Equal(t, clientHalf, decryptedClientHalf)
}

// Test that decrypting a TLF crypt key client half encrypted with the
// default method (currently nacl/box) works.
func TestCryptoClientDecryptEncryptedTLFCryptKeyClientHalf(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	ephPublicKey, ephPrivateKey, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

	// See crypto_common_test.go for tests that this actually
	// performs encryption.
	encryptedClientHalf, err := kbfscrypto.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	require.NoError(t, err)
	require.Equal(t, EncryptionSecretbox, encryptedClientHalf.Version)

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(
		context.Background(), ephPublicKey, encryptedClientHalf)
	require.NoError(t, err)
	require.Equal(t, clientHalf, decryptedClientHalf)
}

// Test that attempting to decrypt an empty set of client keys fails.
func TestCryptoClientDecryptEmptyEncryptedTLFCryptKeyClientHalfAny(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0, 0)

	_, _, err := c.DecryptTLFCryptKeyClientHalfAny(
		context.Background(), keys, false)
	require.IsType(t, NoKeysError{}, errors.Cause(err))
}

// Test that when decrypting set of client keys, the first working one
// is used to decrypt.
func TestCryptoClientDecryptEncryptedTLFCryptKeyClientHalfAny(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0, 4)
	clientHalves := make([]kbfscrypto.TLFCryptKeyClientHalf, 0, 4)
	for i := 0; i < 4; i++ {
		ephPublicKey, ephPrivateKey, err :=
			c.MakeRandomTLFEphemeralKeys()
		require.NoError(t, err)

		cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
		require.NoError(t, err)

		serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
		require.NoError(t, err)

		clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

		// See crypto_common_test.go for tests that this actually
		// performs encryption.
		encryptedClientHalf, err := kbfscrypto.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
		require.NoError(t, err)
		require.Equal(t, EncryptionSecretbox,
			encryptedClientHalf.Version)
		keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
			PubKey:     cryptPrivateKey.GetPublicKey(),
			ClientHalf: encryptedClientHalf,
			EPubKey:    ephPublicKey,
		})
		clientHalves = append(clientHalves, clientHalf)
	}

	decryptedClientHalf, index, err := c.DecryptTLFCryptKeyClientHalfAny(
		context.Background(), keys, false)
	require.NoError(t, err)
	require.Equal(t, clientHalves[0], decryptedClientHalf)
	require.Equal(t, 0, index)
}

// Test various failure cases for DecryptTLFCryptKeyClientHalfAny and that
// if a working key is present, the decryption succeeds.
func TestCryptoClientDecryptTLFCryptKeyClientHalfAnyFailures(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	ephPublicKey, ephPrivateKey, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

	encryptedClientHalf, err := kbfscrypto.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	require.NoError(t, err)

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
	require.NoError(t, err)
	require.Equal(t, len(keys)-1, index)
}

// Test various failure cases for DecryptTLFCryptKeyClientHalf.
func TestCryptoClientDecryptTLFCryptKeyClientHalfFailures(t *testing.T) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey, nil, nil)
	c := newCryptoClientWithClient(codec, log, fc)

	ephPublicKey, ephPrivateKey, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

	encryptedClientHalf, err := kbfscrypto.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	require.NoError(t, err)

	// Wrong version.

	encryptedClientHalfWrongVersion := encryptedClientHalf
	encryptedClientHalfWrongVersion.Version++
	ctx := context.Background()
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongVersion)
	assert.Equal(t,
		kbfscrypto.UnknownEncryptionVer{
			Ver: encryptedClientHalfWrongVersion.Version},
		errors.Cause(err))

	// Wrong sizes.

	encryptedClientHalfWrongSize := encryptedClientHalf
	encryptedClientHalfWrongSize.EncryptedData = encryptedClientHalfWrongSize.EncryptedData[:len(encryptedClientHalfWrongSize.EncryptedData)-1]
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongSize)
	assert.EqualError(t, errors.Cause(err),
		fmt.Sprintf("Expected %d bytes, got %d",
			len(encryptedClientHalf.EncryptedData),
			len(encryptedClientHalfWrongSize.EncryptedData)))

	encryptedClientHalfWrongNonceSize := encryptedClientHalf
	encryptedClientHalfWrongNonceSize.Nonce = encryptedClientHalfWrongNonceSize.Nonce[:len(encryptedClientHalfWrongNonceSize.Nonce)-1]
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfWrongNonceSize)
	assert.Equal(t,
		kbfscrypto.InvalidNonceError{
			Nonce: encryptedClientHalfWrongNonceSize.Nonce},
		errors.Cause(err))

	// Corrupt key.

	ephPublicKeyCorruptData := ephPublicKey.Data()
	ephPublicKeyCorruptData[0] = ^ephPublicKeyCorruptData[0]
	ephPublicKeyCorrupt := kbfscrypto.MakeTLFEphemeralPublicKey(
		ephPublicKeyCorruptData)
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKeyCorrupt,
		encryptedClientHalf)
	assert.Equal(t, libkb.DecryptionError{}, errors.Cause(err))

	// Corrupt data.

	encryptedClientHalfCorruptData := encryptedClientHalf
	encryptedClientHalfCorruptData.EncryptedData[0] = ^encryptedClientHalfCorruptData.EncryptedData[0]
	_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
		encryptedClientHalfCorruptData)
	assert.Equal(t, libkb.DecryptionError{}, errors.Cause(err))
}

// Test that canceling a signing RPC returns the correct error
func TestCryptoClientDecryptTLFCryptKeyClientHalfCanceled(t *testing.T) {
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := kbfscodec.NewMsgpack()
	log := logger.NewTestLogger(t)
	serverConn, conn := rpc.MakeConnectionForTest(t)
	c := newCryptoClientWithClient(codec, log, conn.GetClient())

	ephPublicKey, ephPrivateKey, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := kbfscrypto.MaskTLFCryptKey(serverHalf, cryptKey)

	encryptedClientHalf, err := kbfscrypto.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.GetPublicKey(), clientHalf)
	require.NoError(t, err)

	f := func(ctx context.Context) error {
		_, err = c.DecryptTLFCryptKeyClientHalf(ctx, ephPublicKey,
			encryptedClientHalf)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}
