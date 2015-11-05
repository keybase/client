// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/binary"
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

func (n *Nonce) writeCounter(i uint64) {
	binary.BigEndian.PutUint64((*n)[16:], i)
}

func (n *Nonce) writeCounter32(i uint32) {
	binary.BigEndian.PutUint32((*n)[20:], i)
}

func (e encryptionBlockNumber) newCounterNonce() *Nonce {
	var ret Nonce
	ret.writeCounter(uint64(e))
	return &ret
}

func (e encryptionBlockNumber) check() error {
	if e >= encryptionBlockNumber(0xffffffffffffffff) {
		return ErrPacketOverflow
	}
	return nil
}

func hmacSHA512(key []byte, data []byte) []byte {
	hasher := hmac.New(sha512.New, key)
	hasher.Write(data)
	return hasher.Sum(nil)[0:32]
}

func hashNonceAndAuthTag(nonce *Nonce, ciphertext []byte) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write((*nonce)[:])
	buf.Write(ciphertext[0:poly1305.TagSize])
	return buf.Bytes(), nil
}
