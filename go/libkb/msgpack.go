// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"

	"github.com/keybase/go-codec/codec"
)

func MsgpackDecode(dst interface{}, src []byte) (err error) {
	ch := codecHandle()
	return codec.NewDecoderBytes(src, ch).Decode(dst)
}

func MsgpackEncode(src interface{}) (dst []byte, err error) {
	ch := codecHandle()
	err = codec.NewEncoderBytes(&dst, ch).Encode(src)
	return dst, err
}

// Decode data into out, but make sure that all bytes in data are
// used.
func MsgpackDecodeAll(data []byte, handle *codec.MsgpackHandle, out interface{}) error {
	decoder := codec.NewDecoderBytes(data, handle)
	err := decoder.Decode(out)
	if err != nil {
		return err
	}

	if decoder.NumBytesRead() != len(data) {
		return fmt.Errorf("Did not consume entire buffer: %d byte(s) left", len(data)-decoder.NumBytesRead())
	}
	return nil
}
