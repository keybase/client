// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/keybase/client/go/saltpack"
	"io"
)

// saltpackEncrypt reads from the given source, encrypts it for the given
// receivers from the given sender, armors it, and writes it to sink.
func SaltPackEncrypt(
	source io.Reader, sink io.WriteCloser,
	receivers []NaclDHKeyPublic, sender NaclDHKeyPair) error {
	var receiverBoxKeys []saltpack.BoxPublicKey
	for _, k := range receivers {
		receiverBoxKeys = append(receiverBoxKeys, naclBoxPublicKey(k))
	}

	var bsk saltpack.BoxSecretKey
	if !sender.IsNil() {
		bsk = naclBoxSecretKey(sender)
	}

	plainsink, err := saltpack.NewEncryptArmor62Stream(sink, bsk, receiverBoxKeys)
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
