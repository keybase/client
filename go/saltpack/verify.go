// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

// NewVerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's key is not in keyring,
// it will return an error.
func NewVerifyStream(r io.Reader, keyring SigKeyring) (skey SigningPublicKey, vs io.Reader, err error) {
	s, err := newVerifyStream(r, MessageTypeAttachedSignature)
	if err != nil {
		return nil, nil, err
	}
	skey = keyring.LookupSigningPublicKey(s.header.SenderPublic)
	if skey == nil {
		return nil, nil, ErrNoSenderKey
	}
	s.publicKey = skey
	return skey, s, nil
}

// Verify checks the signature in signedMsg.  It returns the
// signer's public key and a verified message.
func Verify(signedMsg []byte, keyring SigKeyring) (skey SigningPublicKey, verifiedMsg []byte, err error) {
	skey, stream, err := NewVerifyStream(bytes.NewReader(signedMsg), keyring)
	if err != nil {
		return nil, nil, err
	}

	verifiedMsg, err = ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, err
	}
	return skey, verifiedMsg, nil
}

// VerifyDetached verifies that signature is a valid signature for
// message, and that the public key for the signer is in keyring.
// It returns the signer's public key.
func VerifyDetached(message, signature []byte, keyring SigKeyring) (skey SigningPublicKey, err error) {
	s, err := newVerifyStream(bytes.NewBuffer(signature), MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	skey = keyring.LookupSigningPublicKey(s.header.SenderPublic)
	if skey == nil {
		return nil, ErrNoSenderKey
	}

	if err := skey.Verify(computeDetachedDigest(s.header.Nonce, message), s.header.Signature); err != nil {
		return nil, err
	}

	return skey, nil
}
