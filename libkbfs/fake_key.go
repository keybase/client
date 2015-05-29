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
	return sk.GetVerifyingKey()
}

// MakeFakeCryptPublicKeyOrBust creates a random crypt publc key,
// starting with the given seed.
func MakeFakeCryptPublicKeyOrBust(seed string) CryptPublicKey {
	fakeRandomBytes := makeFakeRandomBytes(seed, libkb.NaclDHKeySecretSize)
	var fakeSecret [libkb.NaclDHKeySecretSize]byte
	copy(fakeSecret[:], fakeRandomBytes)
	kp, err := libkb.MakeNaclDHKeyPairFromSecret(fakeSecret)
	if err != nil {
		panic(err)
	}
	return CryptPublicKey{kp.GetKid()}
}
