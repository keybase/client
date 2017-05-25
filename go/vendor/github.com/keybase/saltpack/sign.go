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
func NewSignStream(version Version, signedtext io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	return newSignAttachedStream(version, signedtext, signer)
}

// Sign creates an attached signature message of plaintext from signer.
func Sign(version Version, plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	buf, err := signToStream(version, plaintext, signer, NewSignStream)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// NewSignDetachedStream creates a stream that consumes plaintext
// data.  It will write out a detached signature to the io.Writer
// passed in as detachedsig.
func NewSignDetachedStream(version Version, detachedsig io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	return newSignDetachedStream(version, detachedsig, signer)
}

// SignDetached returns a detached signature of plaintext from
// signer.
func SignDetached(version Version, plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	buf, err := signToStream(version, plaintext, signer, NewSignDetachedStream)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// signToStream creates a signature for plaintext with signer,
// using streamer to generate a signing stream.
func signToStream(version Version, plaintext []byte, signer SigningSecretKey, streamer func(Version, io.Writer, SigningSecretKey) (io.WriteCloser, error)) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	s, err := streamer(version, &buf, signer)
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
