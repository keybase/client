// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package basic

import (
	"crypto/rand"

	"github.com/keybase/saltpack"
	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/nacl/box"
)

// EphemeralKeyCreator creates random ephemeral keys.
type EphemeralKeyCreator struct{}

// CreateEphemeralKey creates a random ephemeral key.
func (c EphemeralKeyCreator) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	return generateBoxKey()
}

// PublicKey is a basic implementation of a saltpack public key
type PublicKey struct {
	EphemeralKeyCreator
	saltpack.RawBoxKey
}

// SecretKey is a basic implementation of a saltpack private key
type SecretKey struct {
	sec saltpack.RawBoxKey
	pub PublicKey
}

// PrecomputedSharedKey is a basic implementation of a saltpack
// precomputed shared key, computed from a BasicPublicKey and a BasicPrivateKey
type PrecomputedSharedKey saltpack.RawBoxKey

// ToKID takes a Publickey and returns a "key ID" or a KID, which is
// just the key itself in this implementation. It can be used to identify
// the key.
func (k PublicKey) ToKID() []byte {
	return k.RawBoxKey[:]
}

// ToRawBoxKeyPointer returns a RawBoxKey from a given public key.
// A RawBoxKey is just a bunch of bytes that can be used in
// the lower-level Box libraries.
func (k PublicKey) ToRawBoxKeyPointer() *saltpack.RawBoxKey {
	ret := k.RawBoxKey
	return &ret
}

// HideIdentity says not to hide the identity of this key.
func (k PublicKey) HideIdentity() bool { return false }

func generateBoxKey() (*SecretKey, error) {
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	ret := NewSecretKey(pub, priv)
	return &ret, nil
}

var _ saltpack.BoxPublicKey = PublicKey{}

// Box runs the NaCl box for the given sender and receiver key.
func (k SecretKey) Box(receiver saltpack.BoxPublicKey, nonce saltpack.Nonce, msg []byte) []byte {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(&k.sec))
	return ret
}

// Unbox runs the NaCl unbox operation on the given ciphertext and nonce,
// using the receiver as the secret key.
func (k SecretKey) Unbox(sender saltpack.BoxPublicKey, nonce saltpack.Nonce, msg []byte) ([]byte, error) {
	ret, ok := box.Open([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(sender.ToRawBoxKeyPointer()), (*[32]byte)(&k.sec))
	if !ok {
		return nil, saltpack.ErrDecryptionFailed
	}
	return ret, nil
}

// GetPublicKey returns the public key that corresponds to this secret key.
func (k SecretKey) GetPublicKey() saltpack.BoxPublicKey {
	return k.pub
}

// Precompute computes a shared key with the passed public key.
func (k SecretKey) Precompute(peer saltpack.BoxPublicKey) saltpack.BoxPrecomputedSharedKey {
	var res PrecomputedSharedKey
	box.Precompute((*[32]byte)(&res), (*[32]byte)(peer.ToRawBoxKeyPointer()), (*[32]byte)(&k.sec))
	return res
}

// NewSecretKey makes a new SecretKey from the raw 32-byte arrays
// the represent Box public and secret keys.
func NewSecretKey(pub, sec *[32]byte) SecretKey {
	return SecretKey{
		sec: saltpack.RawBoxKey(*sec),
		pub: PublicKey{
			RawBoxKey: *pub,
		},
	}
}

var _ saltpack.BoxSecretKey = SecretKey{}

// Box runs the box computation given a precomputed key.
func (k PrecomputedSharedKey) Box(nonce saltpack.Nonce, msg []byte) []byte {
	ret := box.SealAfterPrecomputation([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&k))
	return ret
}

// Unbox runs the unbox computation given a precomputed key.
func (k PrecomputedSharedKey) Unbox(nonce saltpack.Nonce, msg []byte) ([]byte, error) {
	ret, ok := box.OpenAfterPrecomputation([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&k))
	if !ok {
		return nil, saltpack.ErrDecryptionFailed
	}
	return ret, nil
}

var _ saltpack.BoxPrecomputedSharedKey = PrecomputedSharedKey{}

// Keyring holds signing and box secret/public keypairs.
type Keyring struct {
	EphemeralKeyCreator
	encKeys map[PublicKey]SecretKey
	sigKeys map[SigningPublicKey]SigningSecretKey
}

// NewKeyring makes an empty new basic keyring.
func NewKeyring() *Keyring {
	return &Keyring{
		encKeys: make(map[PublicKey]SecretKey),
		sigKeys: make(map[SigningPublicKey]SigningSecretKey),
	}
}

// ImportBoxKey imports an existing Box key into this keyring, from a raw byte arrays,
// first the public, and then the secret key halves.
func (k *Keyring) ImportBoxKey(pub, sec *[32]byte) {
	nk := NewSecretKey(pub, sec)
	k.encKeys[nk.pub] = nk
}

// GenerateBoxKey generates a new Box secret key and imports it into the keyring.
func (k *Keyring) GenerateBoxKey() (*SecretKey, error) {
	ret, err := generateBoxKey()
	if err != nil {
		return nil, err
	}
	k.encKeys[ret.pub] = *ret
	return ret, nil
}

// GenerateSigningKey generates a signing key and import it into the keyring.
func (k *Keyring) GenerateSigningKey() (*SigningSecretKey, error) {
	pub, sec, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	if len(pub) != ed25519.PublicKeySize {
		panic("unexpected public key size")
	}
	var pubArray [ed25519.PublicKeySize]byte
	copy(pubArray[:], pub)

	if len(sec) != ed25519.PrivateKeySize {
		panic("unexpected private key size")
	}
	var privArray [ed25519.PrivateKeySize]byte
	copy(privArray[:], sec)

	ret := NewSigningSecretKey(&pubArray, &privArray)
	return &ret, nil
}

// ImportSigningKey imports the raw signing key into the keyring.
func (k *Keyring) ImportSigningKey(pub *[ed25519.PublicKeySize]byte, sec *[ed25519.PrivateKeySize]byte) {
	nk := NewSigningSecretKey(pub, sec)
	k.sigKeys[nk.pub] = nk
}

func kidToPublicKey(kid []byte) PublicKey {
	var tmp PublicKey
	copy(tmp.RawBoxKey[:], kid)
	return tmp
}

// LookupBoxSecretKey tries to find one of the secret keys in its keyring
// given the possible key IDs. It returns the index and the key, if found, and -1
// and nil otherwise.
func (k *Keyring) LookupBoxSecretKey(kids [][]byte) (int, saltpack.BoxSecretKey) {
	for i, kid := range kids {
		if sk, ok := k.encKeys[kidToPublicKey(kid)]; ok {
			return i, sk
		}
	}
	return -1, nil
}

// LookupBoxPublicKey returns the public key that corresponds to the
// given key ID (or "kid")
func (k *Keyring) LookupBoxPublicKey(kid []byte) saltpack.BoxPublicKey {
	return kidToPublicKey(kid)
}

// GetAllBoxSecretKeys returns all secret Box keys in the keyring.
func (k *Keyring) GetAllBoxSecretKeys() []saltpack.BoxSecretKey {
	var out []saltpack.BoxSecretKey
	for _, v := range k.encKeys {
		out = append(out, v)
	}
	return out
}

// ImportBoxEphemeralKey takes a key ID and returns a public key
// useful for encryption/decryption.
func (k *Keyring) ImportBoxEphemeralKey(kid []byte) saltpack.BoxPublicKey {
	return kidToPublicKey(kid)
}

var _ saltpack.Keyring = (*Keyring)(nil)

// SigningPublicKey is a basic public key used for verifying signatures.
// It's just a wrapper around an array of bytes.
type SigningPublicKey saltpack.RawBoxKey

type rawSigningSecretKey [ed25519.PrivateKeySize]byte

// SigningSecretKey is a basic secret key used for creating signatures
// and also for verifying signatures. It's a wrapper around an array of bytes
// and also the corresponding public key.
type SigningSecretKey struct {
	pub SigningPublicKey
	sec rawSigningSecretKey
}

// Sign runs the NaCl signature scheme on the input message, returning
// a signature.
func (k SigningSecretKey) Sign(msg []byte) (ret []byte, err error) {
	return ed25519.Sign(k.sec[:], msg), nil
}

var _ saltpack.SigningSecretKey = SigningSecretKey{}

// ToKID returns the key id for this signing key. It just returns
// the key itself.
func (k SigningPublicKey) ToKID() []byte {
	return k[:]
}

// GetPublicKey gets the public key that corresponds to this
// secret signing key
func (k SigningSecretKey) GetPublicKey() saltpack.SigningPublicKey {
	return k.pub
}

// Verify runs the NaCl verification routine on the given msg / sig
// input.
func (k SigningPublicKey) Verify(msg []byte, sig []byte) error {
	ok := ed25519.Verify(k[:], msg, sig)
	if !ok {
		return saltpack.ErrBadSignature
	}
	return nil
}

var _ saltpack.SigningPublicKey = SigningPublicKey{}

// NewSigningSecretKey creates a new basic signing key from byte arrays.
func NewSigningSecretKey(pub *[ed25519.PublicKeySize]byte, sec *[ed25519.PrivateKeySize]byte) SigningSecretKey {
	return SigningSecretKey{
		sec: rawSigningSecretKey(*sec),
		pub: SigningPublicKey(*pub),
	}
}

// NewSigningPublicKey creates a new public signing key from a byte array.
func NewSigningPublicKey(pub *[ed25519.PublicKeySize]byte) SigningPublicKey {
	return SigningPublicKey(*pub)
}

func kidToSigningPublicKey(kid []byte) SigningPublicKey {
	var tmp SigningPublicKey
	copy(tmp[:], kid)
	return tmp
}

// LookupSigningPublicKey turns the given key ID ("kid") into a corresponding
// signing public key.
func (k *Keyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	return kidToSigningPublicKey(kid)
}

var _ saltpack.SigKeyring = (*Keyring)(nil)
