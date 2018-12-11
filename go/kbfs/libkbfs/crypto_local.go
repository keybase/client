// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type perTeamKeyPair struct {
	privKey kbfscrypto.TLFPrivateKey
	pubKey  kbfscrypto.TLFPublicKey
}

type perTeamKeyPairs map[keybase1.PerTeamKeyGeneration]perTeamKeyPair

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon
	kbfscrypto.SigningKeySigner
	cryptPrivateKey kbfscrypto.CryptPrivateKey
	teamPrivateKeys map[keybase1.TeamID]perTeamKeyPairs
}

var _ Crypto = (*CryptoLocal)(nil)

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec kbfscodec.Codec,
	signingKey kbfscrypto.SigningKey,
	cryptPrivateKey kbfscrypto.CryptPrivateKey,
	blockCryptVersioner blockCryptVersioner) *CryptoLocal {
	return &CryptoLocal{
		MakeCryptoCommon(codec, blockCryptVersioner),
		kbfscrypto.SigningKeySigner{Key: signingKey},
		cryptPrivateKey,
		make(map[keybase1.TeamID]perTeamKeyPairs),
	}
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey kbfscrypto.TLFEphemeralPublicKey,
	encryptedClientHalf kbfscrypto.EncryptedTLFCryptKeyClientHalf) (
	kbfscrypto.TLFCryptKeyClientHalf, error) {
	return kbfscrypto.DecryptTLFCryptKeyClientHalf(
		c.cryptPrivateKey, publicKey, encryptedClientHalf)
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
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

func (c *CryptoLocal) pubKeyForTeamKeyGeneration(
	teamID keybase1.TeamID, keyGen keybase1.PerTeamKeyGeneration) (
	pubKey kbfscrypto.TLFPublicKey, err error) {
	if c.teamPrivateKeys[teamID] == nil {
		c.teamPrivateKeys[teamID] = make(perTeamKeyPairs)
	}

	teamKeys := c.teamPrivateKeys[teamID]
	kp, ok := teamKeys[keyGen]
	// If a key pair doesn't exist yet for this keygen, generate a
	// random one.
	if !ok {
		pubKey, privKey, _, err := c.MakeRandomTLFKeys()
		if err != nil {
			return kbfscrypto.TLFPublicKey{}, err
		}
		kp = perTeamKeyPair{privKey, pubKey}
		c.teamPrivateKeys[teamID][keyGen] = kp
	}

	return kp.pubKey, nil
}

// DecryptTeamMerkleLeaf implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTeamMerkleLeaf(
	ctx context.Context, teamID keybase1.TeamID,
	publicKey kbfscrypto.TLFEphemeralPublicKey,
	encryptedMerkleLeaf kbfscrypto.EncryptedMerkleLeaf,
	minKeyGen keybase1.PerTeamKeyGeneration) (decryptedData []byte, err error) {
	perTeamKeys := c.teamPrivateKeys[teamID]
	maxKeyGen := keybase1.PerTeamKeyGeneration(len(perTeamKeys))
	for i := minKeyGen; i <= maxKeyGen; i++ {
		decryptedData, err := kbfscrypto.DecryptMerkleLeaf(
			perTeamKeys[i].privKey, publicKey, encryptedMerkleLeaf)
		if err == nil {
			return decryptedData, nil
		}
	}

	return nil, errors.WithStack(libkb.DecryptionError{})
}

// Shutdown implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) Shutdown() {}
