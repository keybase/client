// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"strings"

	"github.com/keybase/client/go/libkb"
)

// The functions below must be used only in tests.

func makeFakeRandomBytes(seed string, byteCount int) []byte {
	paddingLen := byteCount - len(seed)
	if paddingLen > 0 {
		seed = seed + strings.Repeat("0", paddingLen)
	}
	return []byte(seed[:byteCount])
}

// MakeFakeSigningKeyOrBust makes a new signing key from fake
// randomness made from the given seed.
func MakeFakeSigningKeyOrBust(seed string) SigningKey {
	fakeRandomBytes := makeFakeRandomBytes(
		seed, libkb.NaclSigningKeySecretSize)
	var secret [libkb.NaclSigningKeySecretSize]byte
	copy(secret[:], fakeRandomBytes)
	kp, err := libkb.MakeNaclSigningKeyPairFromSecret(secret)
	if err != nil {
		panic(err)
	}
	return NewSigningKey(kp)
}

// MakeFakeVerifyingKeyOrBust makes a new key suitable for verifying
// signatures made from the fake signing key made with the same seed.
func MakeFakeVerifyingKeyOrBust(seed string) VerifyingKey {
	sk := MakeFakeSigningKeyOrBust(seed)
	return sk.GetVerifyingKey()
}

// MakeFakeCryptPrivateKeyOrBust makes a new crypt private key from
// fake randomness made from the given seed.
func MakeFakeCryptPrivateKeyOrBust(seed string) CryptPrivateKey {
	fakeRandomBytes := makeFakeRandomBytes(seed, libkb.NaclDHKeySecretSize)
	var secret [libkb.NaclDHKeySecretSize]byte
	copy(secret[:], fakeRandomBytes)
	kp, err := libkb.MakeNaclDHKeyPairFromSecret(secret)
	if err != nil {
		panic(err)
	}
	return NewCryptPrivateKey(kp)
}

// MakeFakeCryptPublicKeyOrBust makes the public key corresponding to
// the crypt private key made with the same seed.
func MakeFakeCryptPublicKeyOrBust(seed string) CryptPublicKey {
	k := MakeFakeCryptPrivateKeyOrBust(seed)
	return k.GetPublicKey()
}

// MakeFakeTLFCryptKeyOrBust makes a TLF crypt key from the given
// seed.
func MakeFakeTLFCryptKeyOrBust(seed string) TLFCryptKey {
	fakeRandomBytes := makeFakeRandomBytes(seed, 32)
	var key [32]byte
	copy(key[:], fakeRandomBytes[:32])
	return MakeTLFCryptKey(key)
}
