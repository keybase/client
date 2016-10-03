// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/kbfscrypto"
)

// The functions below must be used only in tests or local
// implementations of the interfaces.

func makeFakeRandomBytes(seed string, byteCount int) []byte {
	paddingLen := byteCount - len(seed)
	if paddingLen > 0 {
		seed = seed + strings.Repeat("0", paddingLen)
	}
	return []byte(seed[:byteCount])
}

// SigningKeySecretSize is the size of a SigningKeySecret.
const SigningKeySecretSize = libkb.NaclSigningKeySecretSize

// SigningKeySecret is a secret that can be used to construct a SigningKey.
type SigningKeySecret struct {
	secret [SigningKeySecretSize]byte
}

// makeSigningKey makes a new Nacl signing key from the given secret.
func makeSigningKey(secret SigningKeySecret) (kbfscrypto.SigningKey, error) {
	kp, err := libkb.MakeNaclSigningKeyPairFromSecret(secret.secret)
	if err != nil {
		return kbfscrypto.SigningKey{}, err
	}

	return kbfscrypto.NewSigningKey(kp), nil
}

// MakeFakeSigningKeyOrBust makes a new signing key from fake
// randomness made from the given seed.
func MakeFakeSigningKeyOrBust(seed string) kbfscrypto.SigningKey {
	fakeRandomBytes := makeFakeRandomBytes(seed, SigningKeySecretSize)
	var fakeSecret SigningKeySecret
	copy(fakeSecret.secret[:], fakeRandomBytes)
	signingKey, err := makeSigningKey(fakeSecret)
	if err != nil {
		panic(err)
	}
	return signingKey
}

// MakeFakeVerifyingKeyOrBust makes a new key suitable for verifying
// signatures made from the fake signing key made with the same seed.
func MakeFakeVerifyingKeyOrBust(seed string) kbfscrypto.VerifyingKey {
	sk := MakeFakeSigningKeyOrBust(seed)
	return sk.GetVerifyingKey()
}

// MakeFakeCryptPrivateKeyOrBust makes a new crypt private key from
// fake randomness made from the given seed.
func MakeFakeCryptPrivateKeyOrBust(seed string) CryptPrivateKey {
	fakeRandomBytes := makeFakeRandomBytes(seed, libkb.NaclDHKeySecretSize)
	var fakeSecret CryptPrivateKeySecret
	copy(fakeSecret.secret[:], fakeRandomBytes)
	privateKey, err := makeCryptPrivateKey(fakeSecret)
	if err != nil {
		panic(err)
	}
	return privateKey
}

// MakeFakeCryptPublicKeyOrBust makes the public key corresponding to
// the crypt private key made with the same seed.
func MakeFakeCryptPublicKeyOrBust(seed string) kbfscrypto.CryptPublicKey {
	k := MakeFakeCryptPrivateKeyOrBust(seed)
	return k.getPublicKey()
}
