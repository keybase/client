// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/client/go/kbcmf"
)

func KBCMFEncrypt(source io.Reader, sink io.WriteCloser, recipients [][]NaclDHKeyPublic, sender NaclDHKeyPair) error {
	var r [][]kbcmf.BoxPublicKey
	for _, recipient := range recipients {
		var ur []kbcmf.BoxPublicKey
		for _, k := range recipient {
			ur = append(ur, naclBoxPublicKey(k))
		}
		r = append(r, ur)
	}
	plainsink, err := kbcmf.NewEncryptArmor62Stream(sink, naclBoxSecretKey(sender), r)
	if err != nil {
		return err
	}

	n, err := io.Copy(plainsink, source)
	if err != nil {
		return err
	}
	G.Log.Debug("Encrypt: wrote %d bytes", n)
	if err := plainsink.Close(); err != nil {
		return err
	}
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
