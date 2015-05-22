package libkbfs

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
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

// Make a new signing key from fake randomness made from the given
// seed.
func MakeFakeSigningKeyOrBust(seed string) SigningKey {
	var sk SigningKey
	copy(sk.Secret[:], makeFakeRandomBytes(seed, SigningKeySecretLength))
	return sk
}

// Make a new key suitable for verifying signatures made from the fake
// signing key made with the same seed.
func MakeFakeVerifyingKeyOrBust(seed string) VerifyingKey {
	sk := MakeFakeSigningKeyOrBust(seed)
	vk, err := sk.GetVerifyingKey()
	if err != nil {
		panic(err)
	}
	return vk
}

// A crypt key secret is just CryptKeySecretLength random bytes.
//
// TODO: Ideally, box would expose how many random bytes it needs.
const CryptKeySecretLength = 32

func makeNaclDHKeyPair(secret [CryptKeySecretLength]byte) (*libkb.NaclDHKeyPair, error) {
	r := bytes.NewReader(secret[:])
	pub, priv, err := box.GenerateKey(r)
	if err != nil {
		return nil, err
	}

	if r.Len() > 0 {
		return nil, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return &libkb.NaclDHKeyPair{
		Public:  *pub,
		Private: (*libkb.NaclDHKeyPrivate)(priv),
	}, nil
}

func MakeFakeCryptPublicKeyOrBust(seed string) CryptPublicKey {
	var secret [CryptKeySecretLength]byte
	copy(secret[:], makeFakeRandomBytes(seed, CryptKeySecretLength))
	bk, err := makeNaclDHKeyPair(secret)
	if err != nil {
		panic(err)
	}
	return CryptPublicKey{bk.GetKid()}
}
