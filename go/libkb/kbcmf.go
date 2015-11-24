// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"errors"

	"github.com/keybase/client/go/kbcmf"
	"golang.org/x/crypto/nacl/box"
)

// Wrap types from naclwrap.go in kbcmf interfaces.

type naclBoxPublicKey NaclDHKeyPublic

var _ kbcmf.BoxPublicKey = naclBoxPublicKey{}

func (b naclBoxPublicKey) ToRawBoxKeyPointer() *kbcmf.RawBoxKey {
	return (*kbcmf.RawBoxKey)(&b)
}

func (b naclBoxPublicKey) ToKID() []byte {
	return b[:]
}

type naclBoxSecretKey NaclDHKeyPair

var _ kbcmf.BoxSecretKey = naclBoxSecretKey{}

func (n naclBoxSecretKey) GetPublicKey() kbcmf.BoxPublicKey {
	return naclBoxPublicKey(n.Public)
}

func (n naclBoxSecretKey) Box(
	receiver kbcmf.BoxPublicKey, nonce *kbcmf.Nonce, msg []byte) (
	[]byte, error) {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	return ret, nil
}

var errPublicKeyDecryptionFailed = errors.New("public key decryption failed")

func (n naclBoxSecretKey) Unbox(
	sender kbcmf.BoxPublicKey, nonce *kbcmf.Nonce, msg []byte) (
	[]byte, error) {
	ret, ok := box.Open([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return ret, nil
}

// A secret key also functions as a keyring with a single key.
type naclKeyring naclBoxSecretKey

var _ kbcmf.Keyring = naclKeyring{}

func (n naclKeyring) LookupBoxSecretKey(
	kids [][]byte) (int, kbcmf.BoxSecretKey) {
	sk := (naclBoxSecretKey)(n)
	pkKid := sk.GetPublicKey().ToKID()
	for i, kid := range kids {
		if bytes.Compare(pkKid, kid) == 0 {
			return i, sk
		}
	}

	return -1, nil
}

func (n naclKeyring) LookupBoxPublicKey(kid []byte) kbcmf.BoxPublicKey {
	var pk naclBoxPublicKey
	if len(kid) != len(pk) {
		return nil
	}
	copy(pk[:], kid)
	return pk
}
