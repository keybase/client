// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/keybase/client/go/saltpack"
	"io"
)

func SaltPackDecrypt(
	g *GlobalContext, source io.Reader, sink io.WriteCloser,
	deviceEncryptionKey NaclDHKeyPair,
	checkSender func(*saltpack.MessageKeyInfo) error) (*saltpack.MessageKeyInfo, error) {

	mki, plainsource, frame, err := saltpack.NewDearmor62DecryptStream(
		source, naclKeyring(deviceEncryptionKey))
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
	err = saltpack.CheckArmor62Frame(frame, saltpack.EncryptionArmorHeader, saltpack.EncryptionArmorFooter)
	if err != nil {
		return mki, err
	}

	g.Log.Debug("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, err
	}
	return mki, nil
}
