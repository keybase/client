// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"errors"
	"io"

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

// TODO: Undupe this code with the one in kbcmf.
type closeForwarder []io.WriteCloser

func (c closeForwarder) Write(b []byte) (int, error) {
	return c[0].Write(b)
}

func (c closeForwarder) Close() error {
	for _, w := range c {
		if e := w.Close(); e != nil {
			return e
		}
	}
	return nil
}

const encryptionArmorHeader = "BEGIN KEYBASE ENCRYPTED MESSAGE"
const encryptionArmorFooter = "END KEYBASE ENCRYPTED MESSAGE"

// Like NewEncryptArmor62Stream except we use our own header and
// footer.  newKeybaseEncryptArmor62Stream creates a stream that
// consumes plaintext data.  It will write out encrypted data to the
// io.Writer passed in as ciphertext.  The ciphertext is additionally
// armored with the recommended armor62-style format.
//
// Returns an io.WriteCloser that accepts plaintext data to be
// encrypted; and also returns an error if initialization failed.
func newKeybaseEncryptArmor62Stream(
	ciphertext io.Writer, sender kbcmf.BoxSecretKey,
	receivers [][]kbcmf.BoxPublicKey) (
	plaintext io.WriteCloser, err error) {
	enc, err := kbcmf.NewArmor62EncoderStream(
		ciphertext, encryptionArmorHeader, encryptionArmorFooter)
	if err != nil {
		return nil, err
	}
	out, err := kbcmf.NewEncryptStream(enc, sender, receivers)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil
}
