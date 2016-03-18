// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
)

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

// NewEncryptArmor62Stream creates a stream that consumes plaintext data.
// It will write out encrypted data to the io.Writer passed in as ciphertext.
// The encryption is from the specified sender, and is encrypted for the
// given receivers.
//
// The "brand" is the optional "brand" string to put into the header
// and footer.
//
// The ciphertext is additionally armored with the recommended armor62-style format.
//
// Returns an io.WriteCloser that accepts plaintext data to be encrypted; and
// also returns an error if initialization failed.
func NewEncryptArmor62Stream(ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey, brand string) (plaintext io.WriteCloser, err error) {
	enc, err := NewArmor62EncoderStream(ciphertext, MessageTypeEncryption, brand)
	if err != nil {
		return nil, err
	}
	out, err := NewEncryptStream(enc, sender, receivers)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil
}

// EncryptArmor62Seal is the non-streaming version of NewEncryptArmor62Stream, which
// inputs a plaintext (in bytes) and output a ciphertext (as a string).
func EncryptArmor62Seal(plaintext []byte, sender BoxSecretKey, receivers []BoxPublicKey, brand string) (string, error) {
	var buf bytes.Buffer
	enc, err := NewEncryptArmor62Stream(&buf, sender, receivers, brand)
	if err != nil {
		return "", err
	}
	if _, err := enc.Write(plaintext); err != nil {
		return "", err
	}
	if err := enc.Close(); err != nil {
		return "", err
	}
	return buf.String(), nil
}
