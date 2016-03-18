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
	buf, err := signToStream(plaintext, signer, NewSignStream)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// NewSignDetachedStream creates a stream that consumes plaintext
// data.  It will write out a detached signature to the io.Writer
// passed in as detachedsig.
func NewSignDetachedStream(detachedsig io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	return newSignDetachedStream(detachedsig, signer)
}

// SignDetached returns a detached signature of plaintext from
// signer.
func SignDetached(plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	buf, err := signToStream(plaintext, signer, NewSignDetachedStream)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// signToStream creates a signature for plaintext with signer,
// using streamer to generate a signing stream.
func signToStream(plaintext []byte, signer SigningSecretKey, streamer func(io.Writer, SigningSecretKey) (io.WriteCloser, error)) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	s, err := streamer(&buf, signer)
	if err != nil {
		return nil, err
	}
	if _, err := s.Write(plaintext); err != nil {
		return nil, err
	}
	if err := s.Close(); err != nil {
		return nil, err
	}

	return &buf, nil
}
