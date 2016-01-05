// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
)

// NewSignStream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.  NewSignStream only generates attached signatures.
func NewSignStream(signedtext io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	return newSignAttachedStream(signedtext, signer)
}

// Sign creates an attached signature message of plaintext from signer.
func Sign(plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	var buf bytes.Buffer
	s, err := NewSignStream(&buf, signer)
	if err != nil {
		return nil, err
	}
	if _, err := s.Write(plaintext); err != nil {
		return nil, err
	}
	if err := s.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// SignDetached returns a detached signature of plaintext from
// signer.
func SignDetached(plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}
	header, err := newSignatureHeader(signer.PublicKey(), MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	signature, err := signer.Sign(computeDetachedDigest(header.Nonce, plaintext))
	if err != nil {
		return nil, err
	}
	header.Signature = signature

	return encodeToBytes(header)
}
