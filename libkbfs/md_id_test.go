package libkbfs

import (
	"bytes"
	"testing"
)

// Make sure MdID encodes and decodes properly with minimal overhead.
func TestMdIDEncodeDecode(t *testing.T) {
	codec := NewCodecMsgpack()

	id := fakeMdID(1)

	encodedMdID, err := codec.Encode(id)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedMdID) != DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			DefaultHashByteLength+overhead, len(encodedMdID))
	}

	var id2 MdID
	err = codec.Decode(encodedMdID, &id2)
	if err != nil {
		t.Fatal(err)
	}

	if id != id2 {
		t.Errorf("expected %s, got %s", id, id2)
	}
}

// Make sure the zero MdID value encodes and decodes properly.
func TestMdIDEncodeDecodeZero(t *testing.T) {
	codec := NewCodecMsgpack()
	encodedMdID, err := codec.Encode(MdID{})
	if err != nil {
		t.Fatal(err)
	}

	expectedEncodedMdID := []byte{0xc0}
	if !bytes.Equal(encodedMdID, expectedEncodedMdID) {
		t.Errorf("expected encoding %v, got %v",
			expectedEncodedMdID, encodedMdID)
	}

	var id MdID
	err = codec.Decode(encodedMdID, &id)
	if err != nil {
		t.Fatal(err)
	}

	if id != (MdID{}) {
		t.Errorf("expected empty block ID, got %s", id)
	}
}
