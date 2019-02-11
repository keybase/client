// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"encoding/binary"
	"math"
	"math/rand"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfshash"
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

// Test that MakeRandomIDInRange returns items in the range specified.
func TestRandomIDInRange(t *testing.T) {
	rand.Seed(1)
	idToInt := func(id ID) uint64 {
		idBytes := id.Bytes()[1:9]
		return binary.BigEndian.Uint64(idBytes)
	}
	t.Log("Test that the random IDs are within the range specified.")
	const maxUintFloat = float64(math.MaxUint64)
	for i := uint64(0x1000); i < (math.MaxUint64 / 4); i *= 2 {
		for j := i * 2; j < (math.MaxUint64 / 2); j *= 2 {
			iAsFloat := float64(i) / maxUintFloat
			jAsFloat := float64(j) / maxUintFloat
			id, err := MakeRandomIDInRange(iAsFloat, jAsFloat,
				UseMathRandForTest)
			require.NoError(t, err)
			asInt := idToInt(id)
			require.True(t, asInt >= i)
			require.True(t, asInt < j)
		}
	}

	t.Log("Test that the distribution of IDs is roughly uniform.")
	buckets := make([]int, 16)
	numIds := 100000
	for i := 0; i < numIds; i++ {
		id, err := MakeRandomIDInRange(0, 1.0, UseMathRandForTest)
		require.NoError(t, err)
		asInt := idToInt(id)
		buckets[asInt>>60]++
	}
	t.Log("Buckets:")
	for i, v := range buckets {
		t.Logf("Bucket %x: %d", i, v)
		// They should all be around 100,000/16 = 6250. This tests that they're
		// within 10% in either direction.
		require.InEpsilon(t, numIds/16, v, .10)
	}
}
