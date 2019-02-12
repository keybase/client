package merkleTree

import (
	"bytes"
	"github.com/keybase/go-codec/codec"
)

func codecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

func encodeToBytes(i interface{}) ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(i)
	return encoded, err
}

func decodeFromBytes(p interface{}, b []byte) error {
	return codec.NewDecoderBytes(b, codecHandle()).Decode(p)
}

func deepEqual(i1, i2 interface{}) bool {
	b1, e1 := encodeToBytes(i1)
	b2, e2 := encodeToBytes(i2)
	if e1 != nil || e2 != nil {
		return false
	}
	return bytes.Equal(b1, b2)
}
