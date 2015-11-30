// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"github.com/ugorji/go/codec"
	"io"
)

type encoder interface {
	Encode(v interface{}) error
}

func newEncoder(w io.Writer) encoder {
	return codec.NewEncoder(w, codecHandle())
}

func encodeToBytes(i interface{}) ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(i)
	return encoded, err
}

func decodeFromBytes(p interface{}, b []byte) error {
	return codec.NewDecoderBytes(b, codecHandle()).Decode(p)
}

type framedMsgpackStream struct {
	decoder *codec.Decoder
	seqno   PacketSeqno
}

func newFramedMsgpackStream(r io.Reader) *framedMsgpackStream {
	return &framedMsgpackStream{decoder: codec.NewDecoder(r, codecHandle())}
}

func (r *framedMsgpackStream) Read(i interface{}) (ret PacketSeqno, err error) {
	if err = r.decoder.Decode(i); err != nil {
		return ret, err
	}
	ret = r.seqno
	r.seqno++
	return ret, err
}
