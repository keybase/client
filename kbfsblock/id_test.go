// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/stretchr/testify/require"
)

// Make sure ID encodes and decodes properly with minimal overhead.
func TestIDEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()

	id := FakeID(1)

	encodedID, err := codec.Encode(id)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	require.Equal(t, kbfshash.DefaultHashByteLength+overhead,
		len(encodedID))

	var id2 ID
	err = codec.Decode(encodedID, &id2)
	require.NoError(t, err)
	require.Equal(t, id, id2)
}

// Make sure the zero ID value encodes and decodes properly.
func TestIDEncodeDecodeZero(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	encodedID, err := codec.Encode(ID{})
	require.NoError(t, err)
	require.Equal(t, []byte{0xc0}, encodedID)

	var id ID
	err = codec.Decode(encodedID, &id)
	require.NoError(t, err)
	require.Equal(t, ID{}, id)
}

// Test (very superficially) that MakeTemporaryID() returns non-zero
// values that aren't equal.
func TestTemporaryIDRandom(t *testing.T) {
	b1, err := MakeTemporaryID()
	require.NoError(t, err)
	require.NotEqual(t, ID{}, b1)

	b2, err := MakeTemporaryID()
	require.NoError(t, err)
	require.NotEqual(t, ID{}, b2)

	require.NotEqual(t, b1, b2)
}
