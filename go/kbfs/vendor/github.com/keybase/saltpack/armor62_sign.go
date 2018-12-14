// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "io"

func applyBrand(f func(Version, io.Writer, SigningSecretKey, string) (io.WriteCloser, error), brand string) func(Version, io.Writer, SigningSecretKey) (io.WriteCloser, error) {
	return func(version Version, signedtext io.Writer, signer SigningSecretKey) (io.WriteCloser, error) {
		return f(version, signedtext, signer, brand)
	}
}

// NewSignArmor62Stream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext. The `brand` is optional, and allows you to specify
// your "white label" brand to this signature. NewSignArmor62Stream only
// generates attached signatures.
//
// The signed data is armored with the recommended armor62-style
// format.
func NewSignArmor62Stream(version Version, signedtext io.Writer, signer SigningSecretKey, brand string) (stream io.WriteCloser, err error) {
	enc, err := NewArmor62EncoderStream(signedtext, MessageTypeAttachedSignature, brand)
	if err != nil {
		return nil, err
	}
	out, err := NewSignStream(version, enc, signer)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil
}

// SignArmor62 creates an attached armored signature message of plaintext from signer.
func SignArmor62(version Version, plaintext []byte, signer SigningSecretKey, brand string) (string, error) {
	buf, err := signToStream(version, plaintext, signer, applyBrand(NewSignArmor62Stream, brand))
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// NewSignDetachedArmor62Stream creates a stream that consumes plaintext data.
// It will write out the detached signature to the io.Writer passed in as
// detachedsig. The `brand` is optional, and allows you to specify
// your "white label" brand to this signature.
//
// The signed data is armored with the recommended armor62-style
// NewSignDetachedArmor62Stream only generates detached signatures.
//
// The signature is armored with the recommended armor62-style
// format.
func NewSignDetachedArmor62Stream(version Version, detachedsig io.Writer, signer SigningSecretKey, brand string) (stream io.WriteCloser, err error) {
	enc, err := NewArmor62EncoderStream(detachedsig, MessageTypeDetachedSignature, brand)
	if err != nil {
		return nil, err
	}
	out, err := NewSignDetachedStream(version, enc, signer)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil

}

// SignDetachedArmor62 returns a detached armored signature of plaintext from signer.
func SignDetachedArmor62(version Version, plaintext []byte, signer SigningSecretKey, brand string) (string, error) {
	buf, err := signToStream(version, plaintext, signer, applyBrand(NewSignDetachedArmor62Stream, brand))
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}
