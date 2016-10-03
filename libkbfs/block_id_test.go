// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfshash"
)

func fakeBlockID(b byte) BlockID {
	dh := kbfshash.RawDefaultHash{b}
	h, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return BlockID{h}
}

func fakeBlockIDAdd(id BlockID, b byte) BlockID {
	return fakeBlockID(id.h.Bytes()[1] + b)
}

func fakeBlockIDMul(id BlockID, b byte) BlockID {
	return fakeBlockID(id.h.Bytes()[1] * b)
}

// Make sure BlockID encodes and decodes properly with minimal overhead.
func TestBlockIDEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()

	id := fakeBlockID(1)

	encodedBlockID, err := codec.Encode(id)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedBlockID) != kbfshash.DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			kbfshash.DefaultHashByteLength+overhead,
			len(encodedBlockID))
	}

	var id2 BlockID
	err = codec.Decode(encodedBlockID, &id2)
	if err != nil {
		t.Fatal(err)
	}

	if id != id2 {
		t.Errorf("expected %s, got %s", id, id2)
	}
}

// Make sure the zero BlockID value encodes and decodes properly.
func TestBlockIDEncodeDecodeZero(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	encodedBlockID, err := codec.Encode(BlockID{})
	if err != nil {
		t.Fatal(err)
	}

	expectedEncodedBlockID := []byte{0xc0}
	if !bytes.Equal(encodedBlockID, expectedEncodedBlockID) {
		t.Errorf("expected encoding %v, got %v",
			expectedEncodedBlockID, encodedBlockID)
	}

	var id BlockID
	err = codec.Decode(encodedBlockID, &id)
	if err != nil {
		t.Fatal(err)
	}

	if id != (BlockID{}) {
		t.Errorf("expected empty block ID, got %s", id)
	}
}
