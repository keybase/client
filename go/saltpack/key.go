// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import ()

// RawBoxKey is the raw byte-representation of what a box key should
// look like --- a static 32-byte buffer
type RawBoxKey [32]byte

// SymmetricKey is a template for a symmetric key, a 32-byte static
// buffer.  Used for both NaCl SecretBox.
type SymmetricKey [32]byte

// BoxPublicKey is an generic interface to NaCl's public key Box function.
type BoxPublicKey interface {

	// ToKID outputs the "key ID" that corresponds to this BoxPublicKey.
	// You can do whatever you'd like here, but probably it makes sense just
	// to output the public key as is.
	ToKID() []byte

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
	Box(nonce *Nonce, msg []byte) ([]byte, error)
}

// BoxSecretKey is the secret key corresponding to a BoxPublicKey
type BoxSecretKey interface {

	// Box boxes up data, sent from this secret key, and to the receiver
	// specified.
	Box(receiver BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error)

	// Unobx opens up the box, using this secret key as the receiver key
	// abd the give public key as the sender key.
	Unbox(sender BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error)

	// GetPublicKey gets the public key associated with this secret key.
	GetPublicKey() BoxPublicKey

	// Precompute computes a DH with the given key
	Precompute(sender BoxPublicKey) BoxPrecomputedSharedKey
}

// Keyring is an interface used with decryption; it is call to recover
// public or private keys during the decryption process. Calls can block
// on network action.
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
	GetAllSecretKeys() []BoxSecretKey

	// ImportEphemeralKey imports the ephemeral key into
	// BoxPublicKey format. This key has never been seen before, so
	// will be ephemeral.
	ImportEphemeralKey(kid []byte) BoxPublicKey
}
