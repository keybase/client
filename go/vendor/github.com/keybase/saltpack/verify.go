// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"io"
	"io/ioutil"
)

// NewVerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's key is not in keyring,
// it will return an error.
func NewVerifyStream(versionValidator VersionValidator, r io.Reader, keyring SigKeyring) (skey SigningPublicKey, vs io.Reader, err error) {
	s, err := newVerifyStream(versionValidator, r, MessageTypeAttachedSignature)
	if err != nil {
		return nil, nil, err
	}
	skey = keyring.LookupSigningPublicKey(s.header.SenderPublic)
	if skey == nil {
		return nil, nil, ErrNoSenderKey
	}
	s.publicKey = skey
	return skey, newChunkReader(s), nil
}

// Verify checks the signature in signedMsg. It returns the
// signer's public key and a verified message.
func Verify(versionValidator VersionValidator, signedMsg []byte, keyring SigKeyring) (skey SigningPublicKey, verifiedMsg []byte, err error) {
	skey, stream, err := NewVerifyStream(versionValidator, bytes.NewReader(signedMsg), keyring)
	if err != nil {
		return nil, nil, err
	}

	verifiedMsg, err = ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, err
	}
	return skey, verifiedMsg, nil
}

// VerifyDetachedReader verifies that signature is a valid signature for
// entire message read from message Reader, and that the public key for
// the signer is in keyring. It returns the signer's public key.
func VerifyDetachedReader(versionValidator VersionValidator, message io.Reader, signature []byte, keyring SigKeyring) (skey SigningPublicKey, err error) {
	inputBuffer := bytes.NewBuffer(signature)

	// Use a verifyStream to parse the header.
	s, err := newVerifyStream(versionValidator, inputBuffer, MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	// Reach inside the verifyStream to parse the signature bytes.
	var naclSignature []byte
	_, err = s.mps.Read(&naclSignature)
	if err != nil {
		return nil, err
	}

	// Get the public key.
	skey = keyring.LookupSigningPublicKey(s.header.SenderPublic)
	if skey == nil {
		return nil, ErrNoSenderKey
	}

	// Compute the signed text hash, without requiring us to copy the whole
	// signed text into memory at once.
	hasher := sha512.New()
	hasher.Write(s.headerHash[:])
	if _, err := io.Copy(hasher, message); err != nil {
		return nil, err
	}

	if err := skey.Verify(detachedSignatureInputFromHash(hasher.Sum(nil)), naclSignature); err != nil {
		return nil, err
	}

	return skey, nil
}

// VerifyDetached verifies that signature is a valid signature for
// message, and that the public key for the signer is in keyring.
// It returns the signer's public key.
func VerifyDetached(versionValidator VersionValidator, message, signature []byte, keyring SigKeyring) (skey SigningPublicKey, err error) {
	return VerifyDetachedReader(versionValidator, bytes.NewReader(message), signature, keyring)
}
