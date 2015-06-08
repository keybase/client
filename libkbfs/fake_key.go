package libkbfs

import (
	"strings"

	"github.com/keybase/client/go/libkb"
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

// MakeFakeSigningKeyOrBust makes a new signing key from fake
// randomness made from the given seed.
func MakeFakeSigningKeyOrBust(seed string) SigningKey {
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
func MakeFakeVerifyingKeyOrBust(seed string) VerifyingKey {
	sk := MakeFakeSigningKeyOrBust(seed)
	return sk.getVerifyingKey()
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
func MakeFakeCryptPublicKeyOrBust(seed string) CryptPublicKey {
	k := MakeFakeCryptPrivateKeyOrBust(seed)
	return k.getPublicKey()
}
