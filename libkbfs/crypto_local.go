// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

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
func (k CryptPrivateKey) getPublicKey() kbfscrypto.CryptPublicKey {
	return kbfscrypto.MakeCryptPublicKey(k.kp.Public.GetKID())
}

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon
	kbfscrypto.SigningKeySigner
	cryptPrivateKey CryptPrivateKey
}

var _ Crypto = CryptoLocal{}

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec kbfscodec.Codec,
	signingKey kbfscrypto.SigningKey,
	cryptPrivateKey CryptPrivateKey) CryptoLocal {
	return CryptoLocal{
		MakeCryptoCommon(codec),
		kbfscrypto.SigningKeySigner{Key: signingKey},
		cryptPrivateKey,
	}
}

func (c CryptoLocal) prepareTLFCryptKeyClientHalf(
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf,
	clientHalf kbfscrypto.TLFCryptKeyClientHalf) (
	nonce [24]byte, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	// This check isn't strictly needed, but parallels the
	// implementation in CryptoClient.
	if len(encryptedClientHalf.EncryptedData) != len(clientHalf.Data())+box.Overhead {
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
	publicKey kbfscrypto.TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf kbfscrypto.TLFCryptKeyClientHalf, err error) {
	nonce, err := c.prepareTLFCryptKeyClientHalf(encryptedClientHalf, clientHalf)
	if err != nil {
		return
	}

	publicKeyData := publicKey.Data()
	decryptedData, ok := box.Open(nil, encryptedClientHalf.EncryptedData, &nonce, &publicKeyData, (*[32]byte)(c.cryptPrivateKey.kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(clientHalf.Data()) {
		err = libkb.DecryptionError{}
		return
	}

	var clientHalfData [32]byte
	copy(clientHalfData[:], decryptedData)
	return kbfscrypto.MakeTLFCryptKeyClientHalf(clientHalfData), nil
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoLocal.
func (c CryptoLocal) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, _ bool) (
	clientHalf kbfscrypto.TLFCryptKeyClientHalf, index int, err error) {
	if len(keys) == 0 {
		return clientHalf, index, NoKeysError{}
	}
	for i, k := range keys {
		nonce, err := c.prepareTLFCryptKeyClientHalf(k.ClientHalf, clientHalf)
		if err != nil {
			continue
		}
		ePubKeyData := k.EPubKey.Data()
		decryptedData, ok := box.Open(nil, k.ClientHalf.EncryptedData, &nonce, &ePubKeyData, (*[32]byte)(c.cryptPrivateKey.kp.Private))
		if ok {
			var clientHalfData [32]byte
			copy(clientHalfData[:], decryptedData)
			return kbfscrypto.MakeTLFCryptKeyClientHalf(
				clientHalfData), i, nil
		}
	}
	err = libkb.DecryptionError{}
	return
}

// Shutdown implements the Crypto interface for CryptoLocal.
func (c CryptoLocal) Shutdown() {}
