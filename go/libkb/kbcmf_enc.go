// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/client/go/protocol"
)

func KBCMFEncrypt(source io.Reader, sink io.WriteCloser, recipients []keybase1.PublicKey) error {
	n, err := io.Copy(sink, source)
	if err != nil {
		return err
	}
	G.Log.Debug("Encrypt: wrote %d bytes", n)
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
