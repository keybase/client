// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"encoding"
	"encoding/hex"
	"errors"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
)

const (
	// BranchIDByteLen is the number of bytes in a per-device per-TLF branch ID.
	BranchIDByteLen = 16
	// BranchIDStringLen is the number of characters in the string
	// representation of a per-device per-TLF branch ID.
	BranchIDStringLen = 2 * BranchIDByteLen
)

// BranchID encapsulates a per-device per-TLF branch ID.
type BranchID struct {
	id [BranchIDByteLen]byte
}

var _ encoding.BinaryMarshaler = (*BranchID)(nil)
var _ encoding.BinaryUnmarshaler = (*BranchID)(nil)

// NullBranchID is an empty BranchID
var NullBranchID = BranchID{}

// PendingLocalSquashBranchID indicates a local branch that is not in known
// conflict with the master branch, but just needs to be squashed locally.
var PendingLocalSquashBranchID = BranchID{
	[BranchIDByteLen]byte{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1}}

// Bytes returns the bytes of the BranchID.
func (id BranchID) Bytes() []byte {
	return id.id[:]
}

// String implements the Stringer interface for BranchID.
func (id BranchID) String() string {
	return hex.EncodeToString(id.id[:])
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for BranchID.
func (id BranchID) MarshalBinary() (data []byte, err error) {
	return id.id[:], nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for BranchID.
func (id *BranchID) UnmarshalBinary(data []byte) error {
	if len(data) != BranchIDByteLen {
		return errors.New("invalid BranchID")
	}
	copy(id.id[:], data)
	return nil
}

// ParseBranchID parses a hex encoded BranchID. Returns NullBranchID
// and an InvalidBranchID on falire.
func ParseBranchID(s string) (BranchID, error) {
	if len(s) != BranchIDStringLen {
		return NullBranchID, InvalidBranchID{s}
	}
	bytes, err := hex.DecodeString(s)
	if err != nil {
		return NullBranchID, InvalidBranchID{s}
	}
	var id BranchID
	err = id.UnmarshalBinary(bytes)
	if err != nil {
		return NullBranchID, InvalidBranchID{s}
	}
	return id, nil
}

// MakeRandomBranchID generates a per-device branch ID using a CSPRNG.
// It will not return LocalSquashBranchID or NullBranchID.
func MakeRandomBranchID() (BranchID, error) {
	var id BranchID
	// Loop just in case we randomly pick the null or local squash
	// branch IDs.
	for id == NullBranchID || id == PendingLocalSquashBranchID {
		err := kbfscrypto.RandRead(id.id[:])
		if err != nil {
			return BranchID{}, err
		}
	}
	return id, nil
}

// FakeBranchID creates a fake branch ID from the given byte.
func FakeBranchID(b byte) BranchID {
	bytes := [BranchIDByteLen]byte{b}
	return BranchID{bytes}
}
