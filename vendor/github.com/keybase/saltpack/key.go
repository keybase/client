// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"crypto/hmac"
)

// RawBoxKey is the raw byte-representation of what a box key should
// look like, a static 32-byte buffer. Used for NaCl Box.
type RawBoxKey [32]byte

func rawBoxKeyFromSlice(slice []byte) (*RawBoxKey, error) {
	var result RawBoxKey
	if len(slice) != len(result) {
		return nil, ErrBadBoxKey
	}
	copy(result[:], slice)
	return &result, nil
}

// SymmetricKey is a template for a symmetric key, a 32-byte static
// buffer. Used for NaCl SecretBox.
type SymmetricKey [32]byte

func symmetricKeyFromSlice(slice []byte) (*SymmetricKey, error) {
	var result SymmetricKey
	if len(slice) != len(result) {
		return nil, ErrBadSymmetricKey
	}
	copy(result[:], slice)
	return &result, nil
}

// BasePublicKey types can output a key ID corresponding to the key.
type BasePublicKey interface {
	// ToKID outputs the "key ID" that corresponds to this key.
	// You can do whatever you'd like here, but probably it makes sense just
	// to output the public key as is.
	ToKID() []byte
}

// BoxPublicKey is an generic interface to NaCl's public key Box function.
type BoxPublicKey interface {
	BasePublicKey

	// ToRawBoxKeyPointer returns this public key as a *[32]byte,
	// for use with nacl.box.Seal
	ToRawBoxKeyPointer() *RawBoxKey

	// CreateEmphemeralKey creates an ephemeral key of the same type,
	// but totally random.
	CreateEphemeralKey() (BoxSecretKey, error)

	// HideIdentity returns true if we should hide the identity of this
	// key in our output message format.
	HideIdentity() bool
}

// BoxPrecomputedSharedKey results from a Precomputation below.
type BoxPrecomputedSharedKey interface {
	Unbox(nonce *Nonce, msg []byte) ([]byte, error)
	Box(nonce *Nonce, msg []byte) []byte
}

// BoxSecretKey is the secret key corresponding to a BoxPublicKey
type BoxSecretKey interface {

	// Box boxes up data, sent from this secret key, and to the receiver
	// specified.
	Box(receiver BoxPublicKey, nonce *Nonce, msg []byte) []byte

	// Unobx opens up the box, using this secret key as the receiver key
	// abd the give public key as the sender key.
	Unbox(sender BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error)

	// GetPublicKey gets the public key associated with this secret key.
	GetPublicKey() BoxPublicKey

	// Precompute computes a DH with the given key
	Precompute(sender BoxPublicKey) BoxPrecomputedSharedKey
}

// SigningSecretKey is a secret NaCl key that can sign messages.
type SigningSecretKey interface {
	// Sign signs message with this secret key.
	Sign(message []byte) ([]byte, error)

	// GetPublicKey gets the public key associated with this secret key.
	GetPublicKey() SigningPublicKey
}

// SigningPublicKey is a public NaCl key that can verify
// signatures.
type SigningPublicKey interface {
	BasePublicKey

	// Verify verifies that signature is a valid signature of message for
	// this public key.
	Verify(message []byte, signature []byte) error
}

// Keyring is an interface used with decryption; it is called to
// recover public or private keys during the decryption process.
// Calls can block on network action.
type Keyring interface {
	// LookupBoxSecretKey looks in the Keyring for the secret key corresponding
	// to one of the given Key IDs.  Returns the index and the key on success,
	// or -1 and nil on failure.
	LookupBoxSecretKey(kids [][]byte) (int, BoxSecretKey)

	// LookupBoxPublicKey returns a public key given the specified key ID.
	// For most cases, the key ID will be the key itself.
	LookupBoxPublicKey(kid []byte) BoxPublicKey

	// GetAllSecretKeys returns all keys, needed if we want to support
	// "hidden" receivers via trial and error
	GetAllBoxSecretKeys() []BoxSecretKey

	// ImportEphemeralKey imports the ephemeral key into
	// BoxPublicKey format. This key has never been seen before, so
	// will be ephemeral.
	ImportBoxEphemeralKey(kid []byte) BoxPublicKey
}

// SigKeyring is an interface used during verification to find
// the public key for the signer of a message.
type SigKeyring interface {
	// LookupSigningPublicKey returns a public signing key for the specified key ID.
	LookupSigningPublicKey(kid []byte) SigningPublicKey
}

// PublicKeyEqual returns true if the two public keys are equal.
func PublicKeyEqual(k1, k2 BasePublicKey) bool {
	return hmac.Equal(k1.ToKID(), k2.ToKID())
}
