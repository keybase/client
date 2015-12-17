// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"github.com/ugorji/go/codec"
	"golang.org/x/crypto/poly1305"
)

// encryptionBlockNumber describes which block number we're at in the sequence
// of encrypted blocks. Each encrypted block of course fits into a packet.
type encryptionBlockNumber uint64

func codecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

func randomFill(b []byte) (err error) {
	l := len(b)
	n, err := rand.Read(b)
	if err != nil {
		return err
	}
	if n != l {
		return ErrInsufficientRandomness
	}
	return nil
}

func (e encryptionBlockNumber) check() error {
	if e >= encryptionBlockNumber(0xffffffffffffffff) {
		return ErrPacketOverflow
	}
	return nil
}

func hashNonceAndAuthTag(nonce *Nonce, ciphertext []byte) []byte {
	var buf bytes.Buffer
	buf.Write((*nonce)[:])
	buf.Write(ciphertext[0:poly1305.TagSize])
	return buf.Bytes()
}
