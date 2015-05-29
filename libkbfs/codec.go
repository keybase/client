package libkbfs

import (
	"github.com/ugorji/go/codec"
)

// CodecMsgpack implements the Codec interface using msgpack
// marshaling and unmarshaling.
type CodecMsgpack struct {
	h codec.Handle
}

// NewCodecMsgpack constructs a new CodecMsgpack.
func NewCodecMsgpack() *CodecMsgpack {
	return &CodecMsgpack{&codec.MsgpackHandle{}}
}

// Decode implements the Codec interface for CodecMsgpack
func (c *CodecMsgpack) Decode(buf []byte, obj interface{}) (err error) {
	err = codec.NewDecoderBytes(buf, c.h).Decode(obj)
	return
}

// Encode implements the Codec interface for CodecMsgpack
func (c *CodecMsgpack) Encode(obj interface{}) (buf []byte, err error) {
	err = codec.NewEncoderBytes(&buf, c.h).Encode(obj)
	return
}
