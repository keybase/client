// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/saltpack"
)

func SaltpackDecrypt(m MetaContext, source io.Reader, sink io.WriteCloser,
	decryptionKeyring saltpack.SigncryptKeyring,
	checkSenderMki func(*saltpack.MessageKeyInfo) error,
	checkSenderSigningKey func(saltpack.SigningPublicKey) error,
	keyResolver saltpack.SymmetricKeyResolver) (*saltpack.MessageKeyInfo, error) {

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
		return mki, DecryptionError{Cause: err}
	}

	if typ == saltpack.MessageTypeEncryption && checkSenderMki != nil {
		if err = checkSenderMki(mki); err != nil {
			return mki, DecryptionError{Cause: err}
		}
	}
	if typ == saltpack.MessageTypeSigncryption && checkSenderSigningKey != nil {
		if err = checkSenderSigningKey(senderSigningKey); err != nil {
			return nil, DecryptionError{Cause: err}
		}
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return mki, DecryptionError{Cause: err}
	}

	if isArmored {
		// Note: the following check always passes!
		if err = checkSaltpackBrand(brand); err != nil {
			return mki, DecryptionError{Cause: err}
		}
	}

	m.Debug("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, DecryptionError{Cause: err}
	}
	return mki, nil
}
