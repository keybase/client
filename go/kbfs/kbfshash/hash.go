// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfshash

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/kbfs/cache"
	"github.com/pkg/errors"
)

// See https://keybase.io/admin-docs/hash-format for the design doc
// for the keybase hash format.

const (
	// MinHashByteLength is the minimum number of bytes a valid
	// keybase hash can be, including the 1 byte for the type.
	MinHashByteLength = 33

	// DefaultHashByteLength is the number of bytes in a default
	// keybase hash.
	DefaultHashByteLength = 1 + sha256.Size

	// MaxHashByteLength is the maximum number of bytes a valid
	// keybase hash can be, including the 1 byte for the type.
	MaxHashByteLength = 129

	// MinHashStringLength is the minimum number of characters in
	// the string representation (hex encoding) of a valid keybase
	// hash.
	MinHashStringLength = 2 * MinHashByteLength

	// DefaultHashStringLength is the number of characters in the
	// string representation of a default keybase hash.
	DefaultHashStringLength = 2 * DefaultHashByteLength

	// MaxHashStringLength is the maximum number of characters the
	// string representation of a valid keybase hash can be.
	MaxHashStringLength = 2 * MaxHashByteLength
)

// HashType is the type of a keybase hash.
type HashType byte

const (
	// InvalidHash is the zero HashType value, which is invalid.
	InvalidHash HashType = 0
	// SHA256Hash is the type of a SHA256 hash.
	SHA256Hash HashType = 1
	// SHA256HashV2 is the type of a SHA256 hash over V2-encrypted data.
	SHA256HashV2 HashType = 2

	// MaxHashType is the highest-supported hash type.
	MaxHashType HashType = SHA256HashV2

	// TemporaryHashType is a hash type to be used for random
	// byte-strings that can be used in place of real hashes.
	TemporaryHashType HashType = 0xff
)

// MaxDefaultHash is the maximum value of RawDefaultHash
var MaxDefaultHash = RawDefaultHash{
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
}

func (t HashType) String() string {
	switch t {
	case InvalidHash:
		return "InvalidHash"
	case SHA256Hash:
		return "SHA256Hash"
	case SHA256HashV2:
		return "SHA256HashV2"
	default:
		return fmt.Sprintf("HashType(%d)", t)
	}
}

// DefaultHashType is the current default keybase hash type.
const DefaultHashType HashType = SHA256Hash

// DefaultHashNew is a function that creates a new hash.Hash object
// with the default hash.
var DefaultHashNew = sha256.New

// RawDefaultHash is the type for the raw bytes of a default keybase
// hash. This is exposed for use as in-memory keys.
type RawDefaultHash [sha256.Size]byte

// DoRawDefaultHash computes the default keybase hash of the given
// data, and returns the type and the raw hash bytes.
func DoRawDefaultHash(p []byte) (HashType, RawDefaultHash) {
	return DefaultHashType, RawDefaultHash(sha256.Sum256(p))
}

// Copy returns a copied RawDefaultHash
func (rdh *RawDefaultHash) Copy() *RawDefaultHash {
	if rdh == nil {
		return nil
	}
	hashCopy := RawDefaultHash{}
	copy(hashCopy[:], rdh[:])
	return &hashCopy
}

// Hash is the type of a keybase hash.
type Hash struct {
	// Stored as a string so that this can be used as a map key.
	h string
}

var _ encoding.BinaryMarshaler = Hash{}
var _ encoding.BinaryUnmarshaler = (*Hash)(nil)

var _ encoding.TextMarshaler = Hash{}
var _ encoding.TextUnmarshaler = (*Hash)(nil)

// HashFromRaw creates a hash from a type and raw hash data. If the
// returned error is nil, the returned Hash is valid.
func HashFromRaw(hashType HashType, rawHash []byte) (Hash, error) {
	return HashFromBytes(append([]byte{byte(hashType)}, rawHash...))
}

// HashFromBytes creates a hash from the given byte array. If the
// returned error is nil, the returned Hash is valid.
func HashFromBytes(data []byte) (Hash, error) {
	h := Hash{string(data)}
	if !h.IsValid() {
		return Hash{}, errors.WithStack(InvalidHashError{h})
	}
	return h, nil
}

// HashFromString creates a hash from the given string. If the
// returned error is nil, the returned Hash is valid.
func HashFromString(dataStr string) (Hash, error) {
	data, err := hex.DecodeString(dataStr)
	if err != nil {
		return Hash{}, errors.WithStack(err)
	}
	return HashFromBytes(data)
}

// DefaultHash computes the hash of the given data with the default
// hash type.
func DefaultHash(buf []byte) (Hash, error) {
	hashType, rawHash := DoRawDefaultHash(buf)
	return HashFromRaw(hashType, rawHash[:])
}

// DoHash computes the hash of the given data with the given hash
// type.
func DoHash(buf []byte, ht HashType) (Hash, error) {
	switch ht {
	case SHA256Hash, SHA256HashV2:
	default:
		return Hash{}, errors.WithStack(UnknownHashTypeError{ht})
	}
	_, rawHash := DoRawDefaultHash(buf)
	return HashFromRaw(ht, rawHash[:])
}

func (h Hash) hashType() HashType {
	return HashType(h.h[0])
}

// GetHashType returns the type of this hash.
func (h Hash) GetHashType() HashType {
	return h.hashType()
}

func (h Hash) hashData() []byte {
	return []byte(h.h[1:])
}

// IsValid returns whether the hash is valid. Note that a hash with an
// unknown version is still valid.
func (h Hash) IsValid() bool {
	if len(h.h) < MinHashByteLength {
		return false
	}
	if len(h.h) > MaxHashByteLength {
		return false
	}

	if h.hashType() == InvalidHash {
		return false
	}

	return true
}

// Bytes returns the bytes of the hash.
func (h Hash) Bytes() []byte {
	return []byte(h.h)
}

func (h Hash) String() string {
	return hex.EncodeToString([]byte(h.h))
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// Hash. Returns an error if the hash is invalid and not the zero
// hash.
func (h Hash) MarshalBinary() (data []byte, err error) {
	if h == (Hash{}) {
		return nil, nil
	}

	if !h.IsValid() {
		return nil, errors.WithStack(InvalidHashError{h})
	}

	return []byte(h.h), nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for Hash. Returns an error if the given byte array is non-empty and
// the hash is invalid.
func (h *Hash) UnmarshalBinary(data []byte) error {
	if len(data) == 0 {
		*h = Hash{}
		return nil
	}

	h.h = string(data)
	if !h.IsValid() {
		err := InvalidHashError{*h}
		*h = Hash{}
		return errors.WithStack(err)
	}

	return nil
}

// Verify makes sure that the hash matches the given data and returns
// an error otherwise.
func (h Hash) Verify(buf []byte) error {
	if !h.IsValid() {
		return errors.WithStack(InvalidHashError{h})
	}

	expectedH, err := DoHash(buf, h.hashType())
	if err != nil {
		return err
	}

	if h != expectedH {
		return errors.WithStack(HashMismatchError{expectedH, h})
	}
	return nil
}

// MarshalText implements the encoding.TextMarshaler interface for
// Hash.
func (h Hash) MarshalText() ([]byte, error) {
	return []byte(h.String()), nil
}

// UnmarshalText implements the encoding.TextUnmarshaler interface
// for Hash.
func (h *Hash) UnmarshalText(data []byte) error {
	newH, err := HashFromString(string(data))
	if err != nil {
		return err
	}
	*h = newH
	return nil
}

const ptrSize = 4 << (^uintptr(0) >> 63) // stolen from runtime/internal/sys

// Size implements the cache.Measurable interface.
func (h *Hash) Size() int {
	return len(h.h) + ptrSize
}

var _ cache.Measurable = (*Hash)(nil)

// HMAC is the type of a keybase hash that is an HMAC.
//
// All the constants for Hash also apply to HMAC.
type HMAC struct {
	h Hash
}

var _ encoding.BinaryMarshaler = HMAC{}
var _ encoding.BinaryUnmarshaler = (*HMAC)(nil)

var _ encoding.TextMarshaler = HMAC{}
var _ encoding.TextUnmarshaler = (*HMAC)(nil)

// DefaultHMAC computes the HMAC with the given key of the given data
// using the default hash.
func DefaultHMAC(key, buf []byte) (HMAC, error) {
	mac := hmac.New(DefaultHashNew, key)
	_, err := mac.Write(buf)
	if err != nil {
		return HMAC{}, err
	}
	h, err := HashFromRaw(DefaultHashType, mac.Sum(nil))
	if err != nil {
		return HMAC{}, err
	}
	return HMAC{h}, nil
}

func (hmac HMAC) hashType() HashType {
	return hmac.h.hashType()
}

func (hmac HMAC) hashData() []byte {
	return hmac.h.hashData()
}

// IsValid returns whether the HMAC is valid. Note that an HMAC with an
// unknown version is still valid.
func (hmac HMAC) IsValid() bool {
	return hmac.h.IsValid()
}

// Bytes returns the bytes of the HMAC.
func (hmac HMAC) Bytes() []byte {
	return hmac.h.Bytes()
}

func (hmac HMAC) String() string {
	return hmac.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// HMAC. Returns an error if the HMAC is invalid and not the zero
// HMAC.
func (hmac HMAC) MarshalBinary() (data []byte, err error) {
	return hmac.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for HMAC. Returns an error if the given byte array is non-empty and
// the HMAC is invalid.
func (hmac *HMAC) UnmarshalBinary(data []byte) error {
	return hmac.h.UnmarshalBinary(data)
}

// MarshalText implements the encoding.TextMarshaler interface for
// HMAC.
func (hmac HMAC) MarshalText() ([]byte, error) {
	return hmac.h.MarshalText()
}

// UnmarshalText implements the encoding.TextUnmarshaler interface
// for HMAC.
func (hmac *HMAC) UnmarshalText(data []byte) error {
	return hmac.h.UnmarshalText(data)
}

// Verify makes sure that the HMAC matches the given data.
func (hmac HMAC) Verify(key, buf []byte) error {
	if !hmac.IsValid() {
		return errors.WithStack(InvalidHashError{hmac.h})
	}

	// Once we have multiple hash types we'll need to expand this.
	t := hmac.hashType()
	if t != DefaultHashType {
		return errors.WithStack(UnknownHashTypeError{t})
	}

	expectedHMAC, err := DefaultHMAC(key, buf)
	if err != nil {
		return err
	}
	if hmac != expectedHMAC {
		return errors.WithStack(
			HashMismatchError{expectedHMAC.h, hmac.h})
	}
	return nil
}
