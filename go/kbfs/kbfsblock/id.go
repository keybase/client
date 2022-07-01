// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"encoding"
	"encoding/binary"
	"errors"
	"math"
	"math/rand"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfshash"
)

// ID is the (usually content-based) ID for a data block.
type ID struct {
	h kbfshash.Hash
}

// ZeroID is a zero-valued ID.
var ZeroID = ID{}

var _ encoding.BinaryMarshaler = ID{}
var _ encoding.BinaryUnmarshaler = (*ID)(nil)

var _ encoding.TextMarshaler = ID{}
var _ encoding.TextUnmarshaler = (*ID)(nil)

const (
	// MaxIDStringLength is the maximum length of the string
	// representation of a ID.
	MaxIDStringLength = kbfshash.MaxHashStringLength
)

// IDFromString creates a ID from the given string. If the
// returned error is nil, the returned ID is valid.
func IDFromString(idStr string) (ID, error) {
	h, err := kbfshash.HashFromString(idStr)
	if err != nil {
		return ID{}, err
	}
	return ID{h}, nil
}

// IDFromBytes creates a ID from the given bytes. If the returned error is nil,
// the returned ID is valid.
func IDFromBytes(idBytes []byte) (ID, error) {
	h, err := kbfshash.HashFromBytes(idBytes)
	if err != nil {
		return ID{}, err
	}
	return ID{h}, nil
}

// IsValid returns whether the block ID is valid. A zero block ID is
// considered invalid.
func (id ID) IsValid() bool {
	return id.h.IsValid()
}

// Bytes returns the bytes of the block ID.
func (id ID) Bytes() []byte {
	return id.h.Bytes()
}

func (id ID) String() string {
	return id.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// ID. Returns an error if the ID is invalid and not the zero
// ID.
func (id ID) MarshalBinary() (data []byte, err error) {
	return id.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for ID. Returns an error if the given byte array is non-empty and
// the ID is invalid.
func (id *ID) UnmarshalBinary(data []byte) error {
	return id.h.UnmarshalBinary(data)
}

// MarshalText implements the encoding.TextMarshaler interface for ID.
func (id ID) MarshalText() ([]byte, error) {
	return id.h.MarshalText()
}

// UnmarshalText implements the encoding.TextUnmarshaler interface for
// ID.
func (id *ID) UnmarshalText(buf []byte) error {
	return id.h.UnmarshalText(buf)
}

// HashType returns the type used for this ID.
func (id *ID) HashType() kbfshash.HashType {
	return id.h.GetHashType()
}

func makeRandomID(ht kbfshash.HashType) (ID, error) {
	var dh kbfshash.RawDefaultHash
	err := kbfscrypto.RandRead(dh[:])
	if err != nil {
		return ID{}, err
	}
	h, err := kbfshash.HashFromRaw(ht, dh[:])
	if err != nil {
		return ID{}, err
	}
	return ID{h}, nil
}

// MakeTemporaryID generates a temporary block ID with an invalid hash
// type using a CSPRNG. This is used for indirect blocks before
// they're committed to the server.
func MakeTemporaryID() (ID, error) {
	return makeRandomID(kbfshash.TemporaryHashType)
}

// MakeFakeID generates a fake block ID with a valid hash type using a
// CSPRNG. This is used for fake block IDs in tests.
func MakeFakeID() (ID, error) {
	return makeRandomID(kbfshash.DefaultHashType)
}

const (
	// UseMathRandForTest tells MakeRandomIDInRange to use math/rand for PRNG.
	UseMathRandForTest = true
	// UseRealRandomness tells MakeRandomIDInRange to use crypto/rand for PRNG.
	UseRealRandomness = false
)

// MakeRandomIDInRange generates a random block ID using a CSPRNG, distributing
// the random variable over the interval [start, end), where the full range is
// [0, MaxUint64). This corresponds to a normalized representation of the
// range [kbfshash.RawDefaultHash{}, kbfshash.MaxDefaultHash).
func MakeRandomIDInRange(start, end float64, mathRandForTest bool) (ID, error) {
	if start < 0.0 || 1.0 < end || end <= start {
		return ID{}, errors.New("Expected range within the interval [0.0, 1.0)")
	}
	rangeSize := end - start
	randBuf := [8]byte{}
	var err error
	if mathRandForTest {
		_, err = rand.Read(randBuf[:])
	} else {
		err = kbfscrypto.RandRead(randBuf[:])
	}
	if err != nil {
		return ID{}, err
	}
	// Generate a random unsigned int. Endianness doesn't matter here because
	// the bytes are random.
	randUint := binary.BigEndian.Uint64(randBuf[:])
	const maxUintFloat = float64(math.MaxUint64)
	randFloat := float64(randUint) / maxUintFloat
	// This forms the start. We fill in the rest with zeroes.
	randFloatInInterval := rangeSize*randFloat + start
	scaledRandomUint := uint64(randFloatInInterval * maxUintFloat)
	// Now endianness matters, because we are relying on how the system
	// represented integers while doing the calculation.
	var dh kbfshash.RawDefaultHash
	binary.BigEndian.PutUint64(dh[:], scaledRandomUint)
	h, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType, dh[:])
	if err != nil {
		return ID{}, err
	}
	return ID{h}, nil
}

// MakePermanentID computes the permanent ID of a block given its
// encoded and encrypted contents.
func MakePermanentID(
	encodedEncryptedData []byte, encryptionVer kbfscrypto.EncryptionVer) (
	ID, error) {
	h, err := kbfshash.DoHash(
		encodedEncryptedData, encryptionVer.ToHashType())
	if err != nil {
		return ID{}, err
	}
	return ID{h}, nil
}

// VerifyID verifies that the given block ID is the permanent block ID
// for the given encoded and encrypted data.
func VerifyID(encodedEncryptedData []byte, id ID) error {
	return id.h.Verify(encodedEncryptedData)
}

// FakeID returns an ID derived from the given byte, suitable for
// testing.
func FakeID(b byte) ID {
	dh := kbfshash.RawDefaultHash{b}
	h, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return ID{h}
}

// FakeIDAdd returns an ID derived from the given ID and the given
// byte, suitable for testing.
func FakeIDAdd(id ID, b byte) ID {
	return FakeID(id.h.Bytes()[1] + b)
}

// FakeIDMul returns an ID derived from the given ID and given byte
// using *, suitable for testing.
//
// TODO: Fix the test that breaks when this is replaced with
// FakeIDAdd.
func FakeIDMul(id ID, b byte) ID {
	return FakeID(id.h.Bytes()[1] * b)
}
