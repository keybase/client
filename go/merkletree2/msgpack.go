package merkletree2

import (
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
