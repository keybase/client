// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/client/go/kbcmf"
)

// KBCMFEncrypt reads from the given source, encrypts it for the given
// receivers from the given sender, armors it, and writes it to sink.
func KBCMFEncrypt(
	source io.Reader, sink io.WriteCloser,
	receivers [][]NaclDHKeyPublic, sender NaclDHKeyPair) error {
	var receiverBoxKeys [][]kbcmf.BoxPublicKey
	for _, receiverPublicKeys := range receivers {
		var t []kbcmf.BoxPublicKey
		for _, k := range receiverPublicKeys {
			t = append(t, naclBoxPublicKey(k))
		}
		receiverBoxKeys = append(receiverBoxKeys, t)
	}
	plainsink, err := kbcmf.NewEncryptArmor62Stream(
		sink, naclBoxSecretKey(sender), receiverBoxKeys)
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
