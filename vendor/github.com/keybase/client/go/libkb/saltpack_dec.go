// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/saltpack"
)

func SaltpackDecrypt(
	g *GlobalContext, source io.Reader, sink io.WriteCloser,
	deviceEncryptionKey NaclDHKeyPair,
	checkSender func(*saltpack.MessageKeyInfo) error) (*saltpack.MessageKeyInfo, error) {

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

	var mki *saltpack.MessageKeyInfo
	var plainsource io.Reader
	var frame saltpack.Frame
	if sc.Armored {
		mki, plainsource, frame, err = saltpack.NewDearmor62DecryptStream(source, naclKeyring(deviceEncryptionKey))
	} else {
		mki, plainsource, err = saltpack.NewDecryptStream(source, naclKeyring(deviceEncryptionKey))
	}

	if err != nil {
		return mki, err
	}

	if checkSender != nil {
		if err = checkSender(mki); err != nil {
			return mki, err
		}
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return mki, err
	}

	// TODO: Check header inline, and only warn if the footer
	// doesn't match.
	if sc.Armored {
		var brand string
		brand, err = saltpack.CheckArmor62Frame(frame, saltpack.MessageTypeEncryption)
		if err != nil {
			return mki, err
		}
		if err = checkSaltpackBrand(brand); err != nil {
			return mki, err
		}
	}

	g.Log.Debug("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, err
	}
	return mki, nil
}
