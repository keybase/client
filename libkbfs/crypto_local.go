// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon
	kbfscrypto.SigningKeySigner
	cryptPrivateKey kbfscrypto.CryptPrivateKey
}

var _ Crypto = CryptoLocal{}

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec kbfscodec.Codec,
	signingKey kbfscrypto.SigningKey,
	cryptPrivateKey kbfscrypto.CryptPrivateKey) CryptoLocal {
	return CryptoLocal{
		MakeCryptoCommon(codec),
		kbfscrypto.SigningKeySigner{Key: signingKey},
		cryptPrivateKey,
	}
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoLocal.
func (c CryptoLocal) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey kbfscrypto.TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	kbfscrypto.TLFCryptKeyClientHalf, error) {
	return kbfscrypto.DecryptTLFCryptKeyClientHalf(
		c.cryptPrivateKey, publicKey, encryptedClientHalf)
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoLocal.
func (c CryptoLocal) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, _ bool) (
	clientHalf kbfscrypto.TLFCryptKeyClientHalf, index int, err error) {
	if len(keys) == 0 {
		return kbfscrypto.TLFCryptKeyClientHalf{}, -1,
			errors.WithStack(NoKeysError{})
	}
	var firstNonDecryptionErr error
	for i, k := range keys {
		clientHalf, err := c.DecryptTLFCryptKeyClientHalf(
			ctx, k.EPubKey, k.ClientHalf)
		if err != nil {
			_, isDecryptionError :=
				errors.Cause(err).(libkb.DecryptionError)
			if firstNonDecryptionErr == nil && !isDecryptionError {
				firstNonDecryptionErr = err
			}
			continue
		}
		return clientHalf, i, nil
	}
	// This is to mimic the behavior in
	// CryptoClient.DecryptTLFCryptKeyClientHalfAny, which is to,
	// if all calls to prepareTLFCryptKeyClientHalf failed, return
	// the first prep error, and otherwise to return the error
	// from the service, which is usually libkb.DecryptionError.
	if firstNonDecryptionErr != nil {
		return kbfscrypto.TLFCryptKeyClientHalf{}, -1,
			firstNonDecryptionErr
	}
	return kbfscrypto.TLFCryptKeyClientHalf{}, -1,
		errors.WithStack(libkb.DecryptionError{})
}

// Shutdown implements the Crypto interface for CryptoLocal.
func (c CryptoLocal) Shutdown() {}
