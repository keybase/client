// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"errors"
	"io"
	"io/ioutil"
)

// NewVerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.
func NewVerifyStream(r io.Reader) (skey BoxPublicKey, vs io.Reader, err error) {
	return nil, &verifyStream{}, nil
}

// NewVerifyKeyringStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's public key is not in
// the supplied keyring, it will return an error.
func NewVerifyKeyringStream(r io.Reader, keyring Keyring) (skey BoxPublicKey, vs io.Reader, err error) {
	return nil, &verifyStream{}, nil
}

// Verify checks the signature in signedMsg.  It returns the
// signer's public key and a verified message.
func Verify(signedMsg []byte) (skey BoxPublicKey, verifiedMsg []byte, err error) {
	return verifyBytes(signedMsg, NewVerifyStream)
}

// VerifyKeyring checks the signature in signedMsg and ensures
// that the signer's publice key is in the supplied keyring.  It
// reutrns the signer's public key and a verified message.
func VerifyKeyring(signedMsg []byte, keyring Keyring) (skey BoxPublicKey, verifiedMsg []byte, err error) {
	var ms = func(r io.Reader) (BoxPublicKey, io.Reader, error) {
		return NewVerifyKeyringStream(r, keyring)
	}
	return verifyBytes(signedMsg, ms)
}

func verifyBytes(signedMsg []byte, makeStream func(io.Reader) (BoxPublicKey, io.Reader, error)) (BoxPublicKey, []byte, error) {
	buf := bytes.NewBuffer(signedMsg)
	skey, stream, err := makeStream(buf)
	if err != nil {
		return nil, nil, err
	}
	if stream == nil {
		return nil, nil, ErrNoStream
	}
	verifiedMsg, err := ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, err
	}
	return skey, verifiedMsg, nil
}

type verifyStream struct{}

func (v *verifyStream) Read([]byte) (int, error) {
	return 0, errors.New("not yet implemented")
}
