// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

// InvalidKIDError is returned whenever an invalid KID is detected.
type InvalidKIDError struct {
	kid keybase1.KID
}

func (e InvalidKIDError) Error() string {
	return fmt.Sprintf("Invalid KID %s", e.kid)
}

// InvalidByte32DataError is returned whenever invalid data for a
// 32-byte type is detected.
type InvalidByte32DataError struct {
	data []byte
}

func (e InvalidByte32DataError) Error() string {
	return fmt.Sprintf("Invalid byte32 data %v", e.data)
}

// UnknownSigVer indicates that we can't process a signature because
// it has an unknown version.
type UnknownSigVer struct {
	Ver SigVer
}

// Error implements the error interface for UnknownSigVer
func (e UnknownSigVer) Error() string {
	return fmt.Sprintf("Unknown signature version %d", int(e.Ver))
}

// UnknownEncryptionVer indicates that we can't decrypt an
// encryptedData object because it has an unknown version.
type UnknownEncryptionVer struct {
	Ver EncryptionVer
}

func (e UnknownEncryptionVer) Error() string {
	return fmt.Sprintf("Unknown encryption version %d", int(e.Ver))
}

// InvalidEncryptionVer indicates that we can't decrypt an
// encryptedData object because this data type doesn't support that
// encryption version.
type InvalidEncryptionVer struct {
	Ver EncryptionVer
}

func (e InvalidEncryptionVer) Error() string {
	return fmt.Sprintf("Invalid encryption version %d", int(e.Ver))
}

// InvalidNonceError indicates that an invalid cryptographic nonce was
// detected.
type InvalidNonceError struct {
	Nonce []byte
}

func (e InvalidNonceError) Error() string {
	return fmt.Sprintf("Invalid nonce %v", e.Nonce)
}

// PaddedBlockReadError occurs if the number of bytes read do not
// equal the number of bytes specified.
type PaddedBlockReadError struct {
	ActualLen   int
	ExpectedLen int
}

// Error implements the error interface of PaddedBlockReadError.
func (e PaddedBlockReadError) Error() string {
	return fmt.Sprintf("Reading block data out of padded block resulted in %d bytes, expected %d",
		e.ActualLen, e.ExpectedLen)
}
