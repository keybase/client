// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"bytes"
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfshash"
)

// Make sure ID encodes and decodes properly with minimal overhead.
func TestIDEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()

	id := FakeID(1)

	encodedID, err := codec.Encode(id)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedID) != kbfshash.DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			kbfshash.DefaultHashByteLength+overhead,
			len(encodedID))
	}

	var id2 ID
	err = codec.Decode(encodedID, &id2)
	if err != nil {
		t.Fatal(err)
	}

	if id != id2 {
		t.Errorf("expected %s, got %s", id, id2)
	}
}

// Make sure the zero ID value encodes and decodes properly.
func TestIDEncodeDecodeZero(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	encodedID, err := codec.Encode(ID{})
	if err != nil {
		t.Fatal(err)
	}

	expectedEncodedID := []byte{0xc0}
	if !bytes.Equal(encodedID, expectedEncodedID) {
		t.Errorf("expected encoding %v, got %v",
			expectedEncodedID, encodedID)
	}

	var id ID
	err = codec.Decode(encodedID, &id)
	if err != nil {
		t.Fatal(err)
	}

	if id != (ID{}) {
		t.Errorf("expected empty block ID, got %s", id)
	}
}
