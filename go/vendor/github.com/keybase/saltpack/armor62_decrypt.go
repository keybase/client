// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

var (
	armor62EncryptionHeaderChecker HeaderChecker = func(header string) (string, error) {
		return parseFrame(header, MessageTypeEncryption, headerMarker)
	}
	armor62EncryptionFrameChecker FrameChecker = func(header, footer string) (string, error) {
		return CheckArmor62(header, footer, MessageTypeEncryption)
	}
)

// NewDearmor62DecryptStream makes a new stream that dearmors and decrypts the given
// Reader stream. Pass it a keyring so that it can lookup private and public keys
// as necessary. Returns the MessageKeyInfo recovered during header
// processing, an io.Reader stream from which you can read the plaintext, the armor branding, and
// maybe an error if there was a failure.
func NewDearmor62DecryptStream(versionValidator VersionValidator, ciphertext io.Reader, kr Keyring) (*MessageKeyInfo, io.Reader, string, error) {
	dearmored, frame, err := NewArmor62DecoderStream(ciphertext, armor62EncryptionHeaderChecker, armor62EncryptionFrameChecker)
	if err != nil {
		return nil, nil, "", err
	}
	brand, err := frame.GetBrand()
	if err != nil {
		return nil, nil, "", err
	}
	mki, r, err := NewDecryptStream(versionValidator, dearmored, kr)
	if err != nil {
		return mki, nil, "", err
	}
	return mki, r, brand, nil
}

// Dearmor62DecryptOpen takes an armor62'ed, encrypted ciphertext and attempts to
// dearmor and decrypt it, using the provided keyring. Checks that the frames in the
// armor are as expected. Returns the MessageKeyInfo recovered during message
// processing, the plaintext (if decryption succeeded), the armor branding, and
// maybe an error if there was a failure.
func Dearmor62DecryptOpen(versionValidator VersionValidator, ciphertext string, kr Keyring) (*MessageKeyInfo, []byte, string, error) {
	buf := bytes.NewBufferString(ciphertext)
	mki, s, brand, err := NewDearmor62DecryptStream(versionValidator, buf, kr)
	if err != nil {
		return mki, nil, "", err
	}
	out, err := ioutil.ReadAll(s)
	if err != nil {
		return mki, nil, "", err
	}
	return mki, out, brand, nil
}
