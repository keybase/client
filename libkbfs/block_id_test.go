package libkbfs

import (
	"bytes"
	"testing"
)

func fakeBlockID(b byte) BlockID {
	dh := RawDefaultHash{b}
	h, err := HashFromRaw(DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return BlockID{h}
}

func fakeBlockIDAdd(id BlockID, b byte) BlockID {
	return fakeBlockID(id.h.hashData()[0] + b)
}

func fakeBlockIDMul(id BlockID, b byte) BlockID {
	return fakeBlockID(id.h.hashData()[0] * b)
}

// Make sure BlockID encodes and decodes properly with minimal overhead.
func TestBlockIDEncodeDecode(t *testing.T) {
	codec := NewCodecMsgpack()

	id := fakeBlockID(1)

	encodedBlockID, err := codec.Encode(id)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedBlockID) != DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			DefaultHashByteLength+overhead, len(encodedBlockID))
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
	codec := NewCodecMsgpack()
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
