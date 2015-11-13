// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"github.com/ugorji/go/codec"
	"io"
)

func encodeNewPacket(w io.Writer, p interface{}) error {
	buf, err := encodeToBytes(p)
	if err != nil {
		return err
	}
	l, err := encodeToBytes(len(buf))
	if err != nil {
		return err
	}
	_, err = w.Write(append(l, buf...))
	return err
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
	var frame int
	if err = r.decoder.Decode(&frame); err != nil {
		return ret, err
	}
	if frame == 0 {
		return 0, ErrBadFrame
	}
	if err = r.decoder.Decode(i); err != nil {
		return ret, err
	}
	ret = r.seqno
	r.seqno++
	return ret, err
}
