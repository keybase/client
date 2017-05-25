// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"io"

	"github.com/keybase/go-codec/codec"
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

type msgpackStream struct {
	decoder *codec.Decoder
	seqno   packetSeqno
}

func newMsgpackStream(r io.Reader) *msgpackStream {
	return &msgpackStream{decoder: codec.NewDecoder(r, codecHandle())}
}

func (r *msgpackStream) Read(i interface{}) (ret packetSeqno, err error) {
	if err = r.decoder.Decode(i); err != nil {
		return ret, err
	}
	ret = r.seqno
	r.seqno++
	return ret, nil
}
