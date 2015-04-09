package libkbfs

import (
	"github.com/ugorji/go/codec"
)

type CodecMsgpack struct {
	h codec.Handle
}

func NewCodecMsgpack() *CodecMsgpack {
	return &CodecMsgpack{&codec.MsgpackHandle{}}
}

func (c *CodecMsgpack) Decode(buf []byte, obj interface{}) (err error) {
	err = codec.NewDecoderBytes(buf, c.h).Decode(obj)
	return
}

func (c *CodecMsgpack) Encode(obj interface{}) (buf []byte, err error) {
	err = codec.NewEncoderBytes(&buf, c.h).Encode(obj)
	return
}
