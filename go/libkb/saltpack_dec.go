// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/saltpack"
)

func getStatusCodeFromDecryptionError(err *DecryptionError) (code int) {
	switch err.Cause.Err.(type) {
	case APINetError:
		code = SCAPINetworkError
	case saltpack.ErrNoSenderKey:
		code = SCDecryptionKeyNotFound
	case saltpack.ErrWrongMessageType:
		code = SCWrongCryptoMsgType
	}
	return code
}

func SaltpackDecrypt(m MetaContext, source io.Reader, sink io.WriteCloser,
	decryptionKeyring saltpack.SigncryptKeyring,
	checkSenderMki func(*saltpack.MessageKeyInfo) error,
	checkSenderSigningKey func(saltpack.SigningPublicKey) error,
	keyResolver saltpack.SymmetricKeyResolver) (mki *saltpack.MessageKeyInfo, err error) {
	defer func() {
		if derr, ok := err.(DecryptionError); ok {
			derr.Cause.StatusCode = getStatusCodeFromDecryptionError(&derr)
			err = derr
		}
	}()

	sc, newSource, err := ClassifyStream(source)
	if err != nil {
		return nil, err
	}

	if sc.Format != CryptoMessageFormatSaltpack {
		return nil, WrongCryptoFormatError{
			Wanted:    CryptoMessageFormatSaltpack,
			Received:  sc.Format,
			Operation: "decrypt",
		}
	}

	source = newSource

	// mki will be set for DH mode, senderSigningKey will be set for signcryption mode
	plainsource, typ, mki, senderSigningKey, isArmored, brand, _, err := saltpack.ClassifyEncryptedStreamAndMakeDecoder(source, decryptionKeyring, keyResolver)
	if err != nil {
		return mki, DecryptionError{Cause: ErrorCause{Err: err}}
	}

	if typ == saltpack.MessageTypeEncryption && checkSenderMki != nil {
		if err = checkSenderMki(mki); err != nil {
			return mki, DecryptionError{Cause: ErrorCause{Err: err}}
		}
	}
	if typ == saltpack.MessageTypeSigncryption && checkSenderSigningKey != nil {
		if err = checkSenderSigningKey(senderSigningKey); err != nil {
			return nil, DecryptionError{Cause: ErrorCause{Err: err}}
		}
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return mki, DecryptionError{Cause: ErrorCause{Err: err}}
	}

	if isArmored {
		// Note: the following check always passes!
		if err = checkSaltpackBrand(brand); err != nil {
			return mki, DecryptionError{Cause: ErrorCause{Err: err}}
		}
	}

	m.Debug("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, DecryptionError{Cause: ErrorCause{Err: err}}
	}
	return mki, nil
}
