// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

func newSigncryptArmor62SealStream(ciphertext io.Writer, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, ephemeralKeyCreator EphemeralKeyCreator, rng signcryptRNG, brand string) (plaintext io.WriteCloser, err error) {
	// Note: same "BEGIN SALTPACK ENCRYPTED" visible message type.
	enc, err := NewArmor62EncoderStream(ciphertext, MessageTypeEncryption, brand)
	if err != nil {
		return nil, err
	}
	out, err := newSigncryptSealStream(enc, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, rng)
	if err != nil {
		return nil, err
	}
	return closeForwarder([]io.WriteCloser{out, enc}), nil
}

// NewSigncryptArmor62SealStream creates a stream that consumes plaintext data.
// It will write out signcrypted data to the io.Writer passed in as ciphertext.
// The signcryption is from the specified sender, and is signcrypted for the
// given receivers.
//
// The "brand" is the optional "brand" string to put into the header
// and footer.
//
// The ciphertext is additionally armored with the recommended armor62-style format.
//
// If initialization succeeds, returns an io.WriteCloser that accepts
// plaintext data to be signcrypted and a nil error. Otherwise,
// returns nil and the initialization error.
//
// ephemeralKeyCreator should be the last argument; it's the 2nd one
// to preserve the public API.
func NewSigncryptArmor62SealStream(ciphertext io.Writer, ephemeralKeyCreator EphemeralKeyCreator, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, brand string) (plaintext io.WriteCloser, err error) {
	return newSigncryptArmor62SealStream(ciphertext, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, defaultSigncryptRNG{}, brand)
}

func signcryptArmor62Seal(plaintext []byte, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, ephemeralKeyCreator EphemeralKeyCreator, rng signcryptRNG, brand string) (string, error) {
	var buf bytes.Buffer
	enc, err := newSigncryptArmor62SealStream(&buf, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, rng, brand)
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

// SigncryptArmor62Seal is the non-streaming version of NewSigncryptArmor62SealStream, which
// inputs a plaintext (in bytes) and output a ciphertext (as a string).
//
// ephemeralKeyCreator should be the last argument; it's the 2nd one
// to preserve the public API.
func SigncryptArmor62Seal(plaintext []byte, ephemeralKeyCreator EphemeralKeyCreator, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, brand string) (string, error) {
	return signcryptArmor62Seal(plaintext, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, defaultSigncryptRNG{}, brand)
}

// NewDearmor62SigncryptOpenStream makes a new stream that dearmors and decrypts the given
// Reader stream. Pass it a keyring so that it can lookup private and public keys
// as necessary
func NewDearmor62SigncryptOpenStream(ciphertext io.Reader, keyring SigncryptKeyring, resolver SymmetricKeyResolver) (SigningPublicKey, io.Reader, Frame, error) {
	dearmored, frame, err := NewArmor62DecoderStream(ciphertext)
	if err != nil {
		return nil, nil, nil, err
	}
	mki, r, err := NewSigncryptOpenStream(dearmored, keyring, resolver)
	if err != nil {
		return mki, nil, nil, err
	}
	return mki, r, frame, nil
}

// Dearmor62SigncryptOpen takes an armor62'ed, encrypted ciphertext and attempts to
// dearmor and decrypt it, using the provided keyring. Checks that the frames in the
// armor are as expected. Returns the sender key recovered during message
// processing, the plaintext (if decryption succeeded), the armor branding, and
// maybe an error if there was a failure.
func Dearmor62SigncryptOpen(ciphertext string, keyring SigncryptKeyring, resolver SymmetricKeyResolver) (SigningPublicKey, []byte, string, error) {
	buf := bytes.NewBufferString(ciphertext)
	mki, s, frame, err := NewDearmor62SigncryptOpenStream(buf, keyring, resolver)
	if err != nil {
		return mki, nil, "", err
	}
	out, err := ioutil.ReadAll(s)
	if err != nil {
		return mki, nil, "", err
	}
	var brand string
	if brand, err = CheckArmor62Frame(frame, MessageTypeEncryption); err != nil {
		return mki, nil, brand, err
	}
	return mki, out, brand, nil
}
