package libkbfs

import (
	"bytes"
	"testing"
)

// TestCodecEncodeMap tests that codec.Encode() isn't affected by map
// iteration order.
func TestCodecEncodeMap(t *testing.T) {
	m1 := make(map[int]int)
	m2 := make(map[int]int)
	for i := 0; i < 10; i++ {
		m1[i] = 1
		m2[9-i] = 1
	}

	codec := NewCodecMsgpack()

	b1, err := codec.Encode(m1)
	if err != nil {
		t.Fatal(err)
	}

	b2, err := codec.Encode(m2)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(b1, b2) {
		t.Errorf("%v != %v", b1, b2)
	}
}
