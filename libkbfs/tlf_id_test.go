package libkbfs

import "testing"

func TestTlfIDEncodeDecode(t *testing.T) {
	codec := NewCodecMsgpack()
	id := FakeTlfID(1, true)

	encodedID, err := codec.Encode(id)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedID) != TlfIDByteLen+overhead {
		t.Errorf("expected encoded length %d, got %d",
			TlfIDByteLen+overhead, len(encodedID))
	}

	var id2 TlfID
	err = codec.Decode(encodedID, &id2)
	if err != nil {
		t.Fatal(err)
	}

	if id != id2 {
		t.Errorf("expected %s, got %s", id, id2)
	}
}
