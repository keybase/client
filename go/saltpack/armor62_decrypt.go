// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

// NewDearmor62DecryptStream makes a new stream that dearmors and decrypts the given
// Reader stream. Pass it a keyring so that it can lookup private and public keys
// as necessary
func NewDearmor62DecryptStream(ciphertext io.Reader, kr Keyring) (*MessageKeyInfo, io.Reader, Frame, error) {
	dearmored, frame, err := NewArmor62DecoderStream(ciphertext)
	if err != nil {
		return nil, nil, nil, err
	}
	mki, r, err := NewDecryptStream(dearmored, kr)
	if err != nil {
		return mki, nil, nil, err
	}
	return mki, r, frame, nil
}

// Dearmor62DecryptOpen takes an armor62'ed, encrypted ciphertext and attempts to
// dearmor and decrypt it, using the provided keyring. Checks that the frames in the
// armor are as expected.
func Dearmor62DecryptOpen(ciphertext string, kr Keyring) (*MessageKeyInfo, []byte, error) {
	buf := bytes.NewBufferString(ciphertext)
	mki, s, frame, err := NewDearmor62DecryptStream(buf, kr)
	if err != nil {
		return mki, nil, err
	}
	out, err := ioutil.ReadAll(s)
	if err != nil {
		return mki, nil, err
	}
	if err = CheckArmor62Frame(frame, EncryptionArmorHeader, EncryptionArmorFooter); err != nil {
		return mki, nil, err
	}
	return mki, out, nil
}

// CheckArmor62Frame checks that the frame matches our standard
// keybase begin/end frame
func CheckArmor62Frame(frame Frame, header, footer string) error {
	if hdr, err := frame.GetHeader(); err != nil {
		return err
	} else if hdr != header {
		return ErrBadArmorHeader{header, hdr}
	}
	if ftr, err := frame.GetFooter(); err != nil {
		return err
	} else if ftr != footer {
		return ErrBadArmorFooter{footer, ftr}
	}
	return nil
}
