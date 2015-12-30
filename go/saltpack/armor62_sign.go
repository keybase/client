// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
)

// NewSignArmor62Stream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.  NewSignStream only generates attached signatures.
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
	var buf bytes.Buffer
	s, err := NewSignArmor62Stream(&buf, signer)
	if err != nil {
		return "", err
	}
	if _, err := s.Write(plaintext); err != nil {
		return "", err
	}
	if err := s.Close(); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// SignDetachedArmor62 returns a detached armored signature of plaintext from signer.
func SignDetachedArmor62(plaintext []byte, signer SigningSecretKey) (string, error) {
	sig, err := SignDetached(plaintext, signer)
	if err != nil {
		return "", err
	}
	return Armor62Seal(sig, DetachedSignatureArmorHeader, DetachedSignatureArmorFooter)
}
