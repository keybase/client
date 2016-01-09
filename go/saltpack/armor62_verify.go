// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

// NewDearmor62VerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's key is not in keyring,
// it will return an error. It expects the data it reads from r to
// be armor62-encoded.
func NewDearmor62VerifyStream(r io.Reader, keyring SigKeyring) (skey SigningPublicKey, vs io.Reader, frame Frame, err error) {
	dearmored, frame, err := NewArmor62DecoderStream(r)
	if err != nil {
		return nil, nil, nil, err
	}
	skey, vs, err = NewVerifyStream(dearmored, keyring)
	if err != nil {
		return nil, nil, nil, err
	}
	return skey, vs, frame, nil
}

// Dearmor62Verify checks the signature in signedMsg.  It returns the
// signer's public key and a verified message.  It expects
// signedMsg to be armor62-encoded.
func Dearmor62Verify(signedMsg string, keyring SigKeyring) (skey SigningPublicKey, verifiedMsg []byte, brand string, err error) {
	skey, stream, frame, err := NewDearmor62VerifyStream(bytes.NewBufferString(signedMsg), keyring)
	if err != nil {
		return nil, nil, "", err
	}

	verifiedMsg, err = ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, "", err
	}

	if brand, err = CheckArmor62Frame(frame, MessageTypeAttachedSignature); err != nil {
		return nil, nil, "", err
	}

	return skey, verifiedMsg, brand, nil
}

// Dearmor62VerifyDetachedReader verifies that signature is a valid
// armor62-encoded signature for entire message read from Reader,
// and that the public key for the signer is in keyring. It returns
// the signer's public key.
func Dearmor62VerifyDetachedReader(r io.Reader, signature string, keyring SigKeyring) (skey SigningPublicKey, brand string, err error) {
	dearmored, header, footer, err := Armor62Open(signature)
	if err != nil {
		return nil, "", err
	}
	if brand, err = CheckArmor62(header, footer, MessageTypeDetachedSignature); err != nil {
		return nil, "", err
	}
	skey, err = VerifyDetachedReader(r, dearmored, keyring)
	return skey, brand, err
}

// Dearmor62VerifyDetached verifies that signature is a valid
// armor62-encoded signature for message, and that the public key
// for the signer is in keyring. It returns the signer's public key.
func Dearmor62VerifyDetached(message []byte, signature string, keyring SigKeyring) (skey SigningPublicKey, brand string, err error) {
	return Dearmor62VerifyDetachedReader(bytes.NewReader(message), signature, keyring)
}
