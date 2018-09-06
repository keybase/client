// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

var (
	armor62SignatureHeaderChecker HeaderChecker = func(header string) (string, error) {
		return parseFrame(header, MessageTypeAttachedSignature, headerMarker)
	}
	armor62SignatureFrameChecker FrameChecker = func(header, footer string) (string, error) {
		return CheckArmor62(header, footer, MessageTypeAttachedSignature)
	}
	armor62DetachedSignatureHeaderChecker HeaderChecker = func(header string) (string, error) {
		return parseFrame(header, MessageTypeDetachedSignature, headerMarker)
	}
	armor62DetachedSignatureFrameChecker FrameChecker = func(header, footer string) (string, error) {
		return CheckArmor62(header, footer, MessageTypeDetachedSignature)
	}
)

// NewDearmor62VerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's key is not in keyring,
// it will return an error. It expects the data it reads from r to
// be armor62-encoded.
func NewDearmor62VerifyStream(versionValidator VersionValidator, r io.Reader, keyring SigKeyring) (skey SigningPublicKey, vs io.Reader, brand string, err error) {
	dearmored, frame, err := NewArmor62DecoderStream(r, armor62SignatureHeaderChecker, armor62SignatureFrameChecker)
	if err != nil {
		return nil, nil, "", err
	}
	skey, vs, err = NewVerifyStream(versionValidator, dearmored, keyring)
	if err != nil {
		return nil, nil, "", err
	}
	if brand, err = frame.GetBrand(); err != nil {
		return nil, nil, "", err
	}
	return skey, vs, brand, nil
}

// Dearmor62Verify checks the signature in signedMsg.  It returns the
// signer's public key and a verified message.  It expects
// signedMsg to be armor62-encoded.
func Dearmor62Verify(versionValidator VersionValidator, signedMsg string, keyring SigKeyring) (skey SigningPublicKey, verifiedMsg []byte, brand string, err error) {
	skey, stream, brand, err := NewDearmor62VerifyStream(versionValidator, bytes.NewBufferString(signedMsg), keyring)
	if err != nil {
		return nil, nil, "", err
	}

	verifiedMsg, err = ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, "", err
	}

	return skey, verifiedMsg, brand, nil
}

// Dearmor62VerifyDetachedReader verifies that signature is a valid
// armor62-encoded signature for entire message read from Reader,
// and that the public key for the signer is in keyring. It returns
// the signer's public key.
func Dearmor62VerifyDetachedReader(versionValidator VersionValidator, r io.Reader, signature string, keyring SigKeyring) (skey SigningPublicKey, brand string, err error) {
	dearmored, brand, _, _, err := Armor62OpenWithValidation(signature, armor62DetachedSignatureHeaderChecker, armor62DetachedSignatureFrameChecker)
	if err != nil {
		return nil, "", err
	}
	skey, err = VerifyDetachedReader(versionValidator, r, dearmored, keyring)
	return skey, brand, err
}

// Dearmor62VerifyDetached verifies that signature is a valid
// armor62-encoded signature for message, and that the public key
// for the signer is in keyring. It returns the signer's public key.
func Dearmor62VerifyDetached(versionValidator VersionValidator, message []byte, signature string, keyring SigKeyring) (skey SigningPublicKey, brand string, err error) {
	return Dearmor62VerifyDetachedReader(versionValidator, bytes.NewReader(message), signature, keyring)
}
