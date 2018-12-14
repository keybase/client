// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"crypto/rand"

	"github.com/pkg/errors"
)

// UnexpectedShortCryptoRandRead indicates that fewer bytes were read
// from crypto.rand.Read() than expected.
type UnexpectedShortCryptoRandRead struct {
}

// Error implements the error interface for UnexpectedShortRandRead.
func (e UnexpectedShortCryptoRandRead) Error() string {
	return "Unexpected short read from crypto.rand.Read()"
}

// RandRead is a belt-and-suspenders wrapper around
// crypto.rand.Read().
func RandRead(buf []byte) error {
	n, err := rand.Read(buf)
	if err != nil {
		return errors.WithStack(err)
	}
	// This is truly unexpected, as rand.Read() is supposed to
	// return an error on a short read already!
	if n != len(buf) {
		return errors.WithStack(UnexpectedShortCryptoRandRead{})
	}
	return nil
}
