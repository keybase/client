// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import ()

// RawBoxKey is the raw byte-representation of what a box key should
// look like --- a static 32-byte buffer
type RawBoxKey [32]byte

// SymmetricKey is a template for a symmetric key, a 32-byte static
// buffer.  Used for both NaCl SecretBox and also HMAC keys.
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
}

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be truly random values.
type Nonce [24]byte

// BoxSecretKey is the secret key corresponding to a BoxPublicKey
type BoxSecretKey interface {

	// Box boxes up data, sent from this secret key, and to the receiver
	// specified.
	Box(receiver BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error)

	// Unobx opens up the box, using this secret key as the receiver key
	// abd the give public key as the sender key.
	Unbox(sender BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error)

	// GetPublicKey gets the public key associated with this secret key
	GetPublicKey() BoxPublicKey
}
