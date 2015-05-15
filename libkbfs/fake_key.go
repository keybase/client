package libkbfs

import (
	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
	"io"
	"strings"
)

// The functions below must be used only in tests.

// Make a new fake randomness source that will return up to byteCount
// bytes of fake randomness using the given seed.
func newFakeRandom(seed string, byteCount int) io.Reader {
	paddingLen := byteCount - len(seed)
	if paddingLen > 0 {
		seed = seed + strings.Repeat("0", paddingLen)
	}
	return strings.NewReader(seed)
}

// Make a new Nacl signing key pair from fake randomness made from the
// given seed.
func newFakeNaclSigningKeyPairOrBust(seed string) libkb.NaclSigningKeyPair {
	// ed25519 reads exactly 32 bytes from its randomness source.
	fakeRandom := newFakeRandom(seed, 32)

	pub, priv, err := ed25519.GenerateKey(fakeRandom)
	if err != nil {
		panic(err)
	}

	return libkb.NaclSigningKeyPair{
		Public:  *pub,
		Private: (*libkb.NaclSigningKeyPrivate)(priv),
	}
}

// Make a new key suitable for signing from fake randomness made from
// the given seed.
func NewFakeSigningKeyOrBust(seed string) Key {
	return newFakeNaclSigningKeyPairOrBust(seed)
}

// Make a new key suitable for verifying signatures made from the fake
// key made with the same seed.
func NewFakeVerifyingKeyOrBust(seed string) Key {
	k := newFakeNaclSigningKeyPairOrBust(seed)
	k.Private = nil
	return k
}

// Make a new Nacl DH key pair from fake randomness made from the
// given seed.
func newFakeNaclDHKeyPairOrBust(seed string) libkb.NaclDHKeyPair {
	// box reads exactly 32 bytes from its randomness source.
	fakeRandom := newFakeRandom(seed, 32)

	pub, priv, err := box.GenerateKey(fakeRandom)
	if err != nil {
		panic(err)
	}

	return libkb.NaclDHKeyPair{
		Public:  *pub,
		Private: (*libkb.NaclDHKeyPrivate)(priv),
	}
}

// Make a new key pair for encryption/decryption from fake randomness
// made from the given seed.
func NewFakeBoxKeyPairOrBust(seed string) Key {
	return newFakeNaclDHKeyPairOrBust(seed)
}

// Like NewFakeBoxKeyPairOrBust() but with only the public key.
func NewFakeBoxPublicKeyOrBust(seed string) Key {
	k := newFakeNaclDHKeyPairOrBust(seed)
	k.Private = nil
	return k
}
