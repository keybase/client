// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "io"

// NewSignArmor62Stream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.  NewSignArmor62Stream only generates attached signatures.
//
// The signed data is armored with the recommended armor62-style
// format.
func NewSignArmor62Stream(signedtext io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	enc, err := NewArmor62EncoderStream(signedtext, SignedArmorHeader, SignedArmorFooter)
	if err != nil {
		return nil, err
	}
	out, err := NewSignStream(enc, signer)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil
}

// SignArmor62 creates an attached armored signature message of plaintext from signer.
func SignArmor62(plaintext []byte, signer SigningSecretKey) (string, error) {
	buf, err := signToStream(plaintext, signer, NewSignArmor62Stream)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// NewSignDetachedArmor62Stream creates a stream that consumes plaintext data.
// It will write out the detached signature to the io.Writer passed in as
// detachedsig.  NewSignDetachedArmor62Stream only generates detached signatures.
//
// The signature is armored with the recommended armor62-style
// format.
func NewSignDetachedArmor62Stream(detachedsig io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	enc, err := NewArmor62EncoderStream(detachedsig, DetachedSignatureArmorHeader, DetachedSignatureArmorFooter)
	if err != nil {
		return nil, err
	}
	out, err := NewSignDetachedStream(enc, signer)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil

}

// SignDetachedArmor62 returns a detached armored signature of plaintext from signer.
func SignDetachedArmor62(plaintext []byte, signer SigningSecretKey) (string, error) {
	buf, err := signToStream(plaintext, signer, NewSignDetachedArmor62Stream)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}
