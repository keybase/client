// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/client/go/kbcmf"
)

func KBCMFDecrypt(
	source io.Reader, sink io.WriteCloser,
	deviceEncryptionKey NaclDHKeyPair) error {
	// TODO: Verify header and footer from frame.
	plainsource, _, err := kbcmf.NewDearmor62DecryptStream(source, naclKeyring(deviceEncryptionKey))
	if err != nil {
		return err
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return err
	}
	G.Log.Debug("Decrypt: read %d bytes", n)
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
