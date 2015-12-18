// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"

	"github.com/keybase/client/go/saltpack"
	"golang.org/x/crypto/nacl/box"
)

// Wrap types from naclwrap.go in saltpack interfaces.

type naclBoxPublicKey NaclDHKeyPublic

var _ saltpack.BoxPublicKey = naclBoxPublicKey{}

func (b naclBoxPublicKey) ToKID() []byte {
	return b[:]
}

func (b naclBoxPublicKey) ToRawBoxKeyPointer() *saltpack.RawBoxKey {
	return (*saltpack.RawBoxKey)(&b)
}

func (b naclBoxPublicKey) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	kp, err := GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}

	return naclBoxSecretKey(kp), nil
}

func (b naclBoxPublicKey) HideIdentity() bool {
	return false
}

type naclBoxPrecomputedSharedKey [32]byte

var _ saltpack.BoxPrecomputedSharedKey = naclBoxPrecomputedSharedKey{}

func (k naclBoxPrecomputedSharedKey) Unbox(nonce *saltpack.Nonce, msg []byte) (
	[]byte, error) {
	ret, ok := box.OpenAfterPrecomputation(
		[]byte{}, msg, (*[24]byte)(nonce), (*[32]byte)(&k))
	if !ok {
		return nil, DecryptionError{}
	}
	return ret, nil
}

func (k naclBoxPrecomputedSharedKey) Box(nonce *saltpack.Nonce, msg []byte) ([]byte, error) {
	ret := box.SealAfterPrecomputation([]byte{}, msg, (*[24]byte)(nonce), (*[32]byte)(&k))
	return ret, nil
}

type naclBoxSecretKey NaclDHKeyPair

var _ saltpack.BoxSecretKey = naclBoxSecretKey{}

func (n naclBoxSecretKey) Box(
	receiver saltpack.BoxPublicKey, nonce *saltpack.Nonce, msg []byte) (
	[]byte, error) {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	return ret, nil
}

func (n naclBoxSecretKey) Unbox(
	sender saltpack.BoxPublicKey, nonce *saltpack.Nonce, msg []byte) (
	[]byte, error) {
	ret, ok := box.Open([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	if !ok {
		return nil, DecryptionError{}
	}
	return ret, nil
}

func (n naclBoxSecretKey) GetPublicKey() saltpack.BoxPublicKey {
	return naclBoxPublicKey(n.Public)
}

func (n naclBoxSecretKey) Precompute(
	sender saltpack.BoxPublicKey) saltpack.BoxPrecomputedSharedKey {
	var res naclBoxPrecomputedSharedKey
	box.Precompute((*[32]byte)(&res),
		(*[32]byte)(sender.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	return res
}

// A secret key also functions as a keyring with a single key.
type naclKeyring naclBoxSecretKey

var _ saltpack.Keyring = naclKeyring{}

func (n naclKeyring) LookupBoxSecretKey(
	kids [][]byte) (int, saltpack.BoxSecretKey) {
	sk := (naclBoxSecretKey)(n)
	pkKid := sk.GetPublicKey().ToKID()
	for i, kid := range kids {
		if bytes.Compare(pkKid, kid) == 0 {
			return i, sk
		}
	}

	return -1, nil
}

func (n naclKeyring) LookupBoxPublicKey(kid []byte) saltpack.BoxPublicKey {
	var pk naclBoxPublicKey
	if len(kid) != len(pk) {
		return nil
	}
	copy(pk[:], kid)
	return pk
}

func (n naclKeyring) GetAllSecretKeys() []saltpack.BoxSecretKey {
	return []saltpack.BoxSecretKey{naclBoxSecretKey(n)}
}

func (n naclKeyring) ImportEphemeralKey(kid []byte) saltpack.BoxPublicKey {
	return n.LookupBoxPublicKey(kid)
}
