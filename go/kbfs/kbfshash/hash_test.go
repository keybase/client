// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfshash

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

// Make sure Hash encodes and decodes properly with minimal overhead.
func TestHashEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	h, err := DefaultHash([]byte{1})
	require.NoError(t, err)

	encodedH, err := codec.Encode(h)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	require.Equal(t, DefaultHashByteLength+overhead, len(encodedH))

	var h2 Hash
	err = codec.Decode(encodedH, &h2)
	require.NoError(t, err)

	require.Equal(t, h, h2)
}

// Make sure the zero Hash value encodes and decodes properly.
func TestHashEncodeDecodeZero(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	encodedH, err := codec.Encode(Hash{})
	require.NoError(t, err)

	expectedEncodedH := []byte{0xc0}
	require.Equal(t, expectedEncodedH, encodedH)

	var h Hash
	err = codec.Decode(encodedH, &h)
	require.NoError(t, err)

	require.Equal(t, Hash{}, h)
}

// Make sure that default hash gives a valid hash that verifies.
func TestDefaultHash(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}
	h, err := DefaultHash(data)
	require.NoError(t, err)

	require.True(t, h.IsValid())

	err = h.Verify(data)
	require.NoError(t, err)
}

// hashFromRawNoCheck() is like HashFromRaw() except it doesn't check
// validity.
func hashFromRawNoCheck(hashType HashType, rawHash []byte) Hash {
	return Hash{string(append([]byte{byte(hashType)}, rawHash...))}
}

// Make sure Hash.IsValid() fails properly.
func TestHashIsValid(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}
	validH, err := DefaultHash(data)
	require.NoError(t, err)

	// Zero hash.
	require.False(t, (Hash{}).IsValid())

	var smallH Hash
	smallH.h = validH.h[:MinHashByteLength-1]
	require.False(t, smallH.IsValid())

	var largeH Hash
	padding := make([]byte, MaxHashByteLength-len(validH.h)+1)
	largeH.h = string(append([]byte(validH.h), padding...))
	require.False(t, largeH.IsValid())

	invalidH := hashFromRawNoCheck(InvalidHash, validH.hashData())
	require.False(t, invalidH.IsValid())

	// A hash with an unknown version is still valid.
	unknownH := hashFromRawNoCheck(validH.hashType()+1, validH.hashData())
	require.True(t, unknownH.IsValid())
}

// Make sure Hash.Verify() fails properly.
func TestHashVerify(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}

	// Zero (invalid) hash.
	err := (Hash{}).Verify(data)
	require.Equal(t, InvalidHashError{Hash{}}, errors.Cause(err))

	validH, err := DefaultHash(data)
	require.NoError(t, err)

	corruptData := make([]byte, len(data))
	copy(corruptData, data)
	corruptData[0] ^= 1
	err = validH.Verify(corruptData)
	require.IsType(t, HashMismatchError{}, errors.Cause(err))

	invalidH := hashFromRawNoCheck(InvalidHash, validH.hashData())
	err = invalidH.Verify(data)
	require.Equal(t, InvalidHashError{invalidH}, errors.Cause(err))

	// v2 should verify the same way as v1.
	v2ValidH := hashFromRawNoCheck(SHA256HashV2, validH.hashData())
	err = v2ValidH.Verify(data)
	require.NoError(t, err)

	unknownType := validH.hashType() + 2
	unknownH := hashFromRawNoCheck(unknownType, validH.hashData())
	err = unknownH.Verify(data)
	require.Equal(t, UnknownHashTypeError{unknownType}, errors.Cause(err))

	hashData := validH.hashData()
	hashData[0] ^= 1
	corruptH := hashFromRawNoCheck(validH.hashType(), hashData)
	err = corruptH.Verify(data)
	require.IsType(t, HashMismatchError{}, errors.Cause(err))
}

// Make sure HMAC encodes and decodes properly with minimal overhead.
func TestHMACEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	hmac, err := DefaultHMAC([]byte{1}, []byte{2})
	require.NoError(t, err)

	encodedHMAC, err := codec.Encode(hmac)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	require.Equal(t, DefaultHashByteLength+overhead, len(encodedHMAC))

	var hmac2 HMAC
	err = codec.Decode(encodedHMAC, &hmac2)
	require.NoError(t, err)

	require.Equal(t, hmac, hmac2)
}

// Make sure the zero Hash value encodes and decodes properly.
func TestHMACEncodeDecodeZero(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	encodedHMAC, err := codec.Encode(HMAC{})
	require.NoError(t, err)

	expectedEncodedHMAC := []byte{0xc0}
	require.Equal(t, expectedEncodedHMAC, encodedHMAC)

	var hmac HMAC
	err = codec.Decode(encodedHMAC, &hmac)
	require.NoError(t, err)

	require.Equal(t, HMAC{}, hmac)
}

// Make sure that default HMAC gives a valid HMAC that verifies.
func TestDefaultHMAC(t *testing.T) {
	key := []byte{1, 2}
	data := []byte{1, 2, 3, 4, 5}
	hmac, err := DefaultHMAC(key, data)
	require.NoError(t, err)

	require.True(t, hmac.IsValid())

	err = hmac.Verify(key, data)
	require.NoError(t, err)
}

// No need to test HMAC.IsValid().

// hmacFromRawNoCheck() is like HmacFromRaw() except it doesn't check
// validity.
func hmacFromRawNoCheck(hashType HashType, rawHash []byte) HMAC {
	h := hashFromRawNoCheck(hashType, rawHash)
	return HMAC{h}
}

// Make sure HMAC.Verify() fails properly.
func TestVerify(t *testing.T) {
	key := []byte{1, 2}
	data := []byte{1, 2, 3, 4, 5}

	// Zero (invalid) HMAC.
	err := (HMAC{}).Verify(key, data)
	require.Equal(t, InvalidHashError{Hash{}}, errors.Cause(err))

	validHMAC, err := DefaultHMAC(key, data)
	require.NoError(t, errors.Cause(err))

	corruptKey := make([]byte, len(key))
	copy(corruptKey, key)
	corruptKey[0] ^= 1
	err = validHMAC.Verify(corruptKey, data)
	require.IsType(t, HashMismatchError{}, errors.Cause(err))

	corruptData := make([]byte, len(data))
	copy(corruptData, data)
	corruptData[0] ^= 1
	err = validHMAC.Verify(key, corruptData)
	require.IsType(t, HashMismatchError{}, errors.Cause(err))

	invalidHMAC := hmacFromRawNoCheck(InvalidHash, validHMAC.hashData())
	err = invalidHMAC.Verify(key, data)
	require.Equal(t, InvalidHashError{invalidHMAC.h}, errors.Cause(err))

	unknownType := validHMAC.hashType() + 1
	unknownHMAC := hmacFromRawNoCheck(unknownType, validHMAC.hashData())
	err = unknownHMAC.Verify(key, data)
	require.Equal(t, UnknownHashTypeError{unknownType}, errors.Cause(err))

	hashData := validHMAC.hashData()
	hashData[0] ^= 1
	corruptHMAC := hmacFromRawNoCheck(validHMAC.hashType(), hashData)
	err = corruptHMAC.Verify(key, data)
	require.IsType(t, HashMismatchError{}, errors.Cause(err))
}
