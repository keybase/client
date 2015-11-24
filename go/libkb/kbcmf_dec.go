// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/kbcmf"
)

// TODO: Combine this code with the equivalent in kbcmf.

// ErrBadArmorHeader shows up when we get the wrong value for our header
type ErrBadArmorHeader struct {
	wanted   string
	received string
}

// ErrBadArmorFooter shows up when we get the wrong value for our header
type ErrBadArmorFooter struct {
	wanted   string
	received string
}

func (e ErrBadArmorHeader) Error() string {
	return fmt.Sprintf("Bad encryption armor header; wanted '%s' but got '%s'",
		e.wanted, e.received)
}

func (e ErrBadArmorFooter) Error() string {
	return fmt.Sprintf("Bad encryption armor footer; wanted '%s' but got '%s'",
		e.wanted, e.received)
}

func checkArmor62Frame(frame kbcmf.Frame) error {
	if hdr, err := frame.GetHeader(); err != nil {
		return err
	} else if hdr != keybaseEncryptionArmorHeader {
		return ErrBadArmorHeader{keybaseEncryptionArmorHeader, hdr}
	}
	if ftr, err := frame.GetFooter(); err != nil {
		return err
	} else if ftr != keybaseEncryptionArmorFooter {
		return ErrBadArmorFooter{keybaseEncryptionArmorFooter, ftr}
	}
	return nil
}

func KBCMFDecrypt(
	source io.Reader, sink io.WriteCloser,
	deviceEncryptionKey NaclDHKeyPair) error {
	plainsource, frame, err := kbcmf.NewDearmor62DecryptStream(
		source, naclKeyring(deviceEncryptionKey))
	if err != nil {
		return err
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return err
	}

	err = checkArmor62Frame(frame)
	if err != nil {
		return err
	}

	G.Log.Debug("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
