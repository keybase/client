// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/kbfscodec"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

// SigningKeySecretSize is the size of a SigningKeySecret.
const SigningKeySecretSize = libkb.NaclSigningKeySecretSize

// SigningKeySecret is a secret that can be used to construct a SigningKey.
type SigningKeySecret struct {
	secret [SigningKeySecretSize]byte
}

// SigningKey is a key pair for signing.
type SigningKey struct {
	kp libkb.NaclSigningKeyPair
}

// makeSigningKey makes a new Nacl signing key from the given secret.
func makeSigningKey(secret SigningKeySecret) (SigningKey, error) {
	kp, err := libkb.MakeNaclSigningKeyPairFromSecret(secret.secret)
	if err != nil {
		return SigningKey{}, err
	}

	return SigningKey{kp}, nil
}

// NewSigningKey returns a SigningKey using the given key pair.
func NewSigningKey(kp libkb.NaclSigningKeyPair) SigningKey {
	return SigningKey{kp}
}

// GetVerifyingKey returns the public key half of this signing key.
func (k SigningKey) GetVerifyingKey() VerifyingKey {
	return MakeVerifyingKey(k.kp.Public.GetKID())
}

// CryptPrivateKeySecretSize is the size of a CryptPrivateKeySecret.
const CryptPrivateKeySecretSize = libkb.NaclDHKeySecretSize

// CryptPrivateKeySecret is a secret that can be used to construct a
// CryptPrivateKey.
type CryptPrivateKeySecret struct {
	secret [CryptPrivateKeySecretSize]byte
}

// CryptPrivateKey is a private key for encryption/decryption.
type CryptPrivateKey struct {
	kp libkb.NaclDHKeyPair
}

// makeCryptPrivateKey makes a new Nacl encryption/decryption key from
// the given secret.
func makeCryptPrivateKey(secret CryptPrivateKeySecret) (CryptPrivateKey, error) {
	kp, err := libkb.MakeNaclDHKeyPairFromSecret(secret.secret)
	if err != nil {
		return CryptPrivateKey{}, err
	}

	return CryptPrivateKey{kp}, nil
}

// GetPublicKey returns the public key corresponding to this private
// key.
func (k CryptPrivateKey) getPublicKey() CryptPublicKey {
	return MakeCryptPublicKey(k.kp.Public.GetKID())
}

type cryptoSignerLocal struct {
	signingKey SigningKey
}

func (c cryptoSignerLocal) Sign(ctx context.Context, msg []byte) (
	sigInfo SignatureInfo, err error) {
	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    c.signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: c.signingKey.GetVerifyingKey(),
	}
	return
}

func (c cryptoSignerLocal) SignToString(ctx context.Context, msg []byte) (
	signature string, err error) {
	signature, _, err = c.signingKey.kp.SignToString(msg)
	return
}

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon
	cryptoSignerLocal
	cryptPrivateKey CryptPrivateKey
}

var _ Crypto = CryptoLocal{}

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec kbfscodec.Codec,
	signingKey SigningKey, cryptPrivateKey CryptPrivateKey) CryptoLocal {
	return CryptoLocal{
		MakeCryptoCommon(codec),
		cryptoSignerLocal{signingKey},
		cryptPrivateKey,
	}
}

func (c CryptoLocal) prepareTLFCryptKeyClientHalf(encryptedClientHalf EncryptedTLFCryptKeyClientHalf,
	clientHalf TLFCryptKeyClientHalf) (
	nonce [24]byte, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	// This check isn't strictly needed, but parallels the
	// implementation in CryptoClient.
	if len(encryptedClientHalf.EncryptedData) != len(clientHalf.data)+box.Overhead {
		err = libkb.DecryptionError{}
		return
	}

	if len(encryptedClientHalf.Nonce) != len(nonce) {
		err = InvalidNonceError{encryptedClientHalf.Nonce}
		return
	}
	copy(nonce[:], encryptedClientHalf.Nonce)
	return
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoLocal.
func (c CryptoLocal) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf TLFCryptKeyClientHalf, err error) {
	nonce, err := c.prepareTLFCryptKeyClientHalf(encryptedClientHalf, clientHalf)
	if err != nil {
		return
	}

	decryptedData, ok := box.Open(nil, encryptedClientHalf.EncryptedData, &nonce, (*[32]byte)(&publicKey.data), (*[32]byte)(c.cryptPrivateKey.kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(clientHalf.data) {
		err = libkb.DecryptionError{}
		return
	}

	copy(clientHalf.data[:], decryptedData)
	return
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoLocal.
func (c CryptoLocal) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, _ bool) (
	clientHalf TLFCryptKeyClientHalf, index int, err error) {
	if len(keys) == 0 {
		return clientHalf, index, NoKeysError{}
	}
	for i, k := range keys {
		nonce, err := c.prepareTLFCryptKeyClientHalf(k.ClientHalf, clientHalf)
		if err != nil {
			continue
		}
		decryptedData, ok := box.Open(nil, k.ClientHalf.EncryptedData, &nonce, (*[32]byte)(&k.EPubKey.data), (*[32]byte)(c.cryptPrivateKey.kp.Private))
		if ok {
			copy(clientHalf.data[:], decryptedData)
			return clientHalf, i, nil
		}
	}
	err = libkb.DecryptionError{}
	return
}

// Shutdown implements the Crypto interface for CryptoLocal.
func (c CryptoLocal) Shutdown() {}
