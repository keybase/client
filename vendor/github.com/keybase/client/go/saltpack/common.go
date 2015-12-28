// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"crypto/sha512"
	"encoding/binary"
	"io"

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

func writeNullTerminatedString(w io.Writer, s string) {
	w.Write([]byte(s))
	w.Write([]byte{0})
}

func assertEndOfStream(stream *msgpackStream) error {
	var i interface{}
	_, err := stream.Read(&i)
	if err == nil {
		err = ErrTrailingGarbage
	}
	return err
}

func computeAttachedDigest(nonce []byte, block *SignatureBlock) []byte {
	hasher := sha512.New()
	hasher.Write(nonce)
	binary.Write(hasher, binary.BigEndian, block.seqno)
	hasher.Write(block.PayloadChunk)

	var buf bytes.Buffer
	writeNullTerminatedString(&buf, SaltPackFormatName)
	writeNullTerminatedString(&buf, SignatureAttachedString)
	buf.Write(hasher.Sum(nil))

	return buf.Bytes()
}

func computeDetachedDigest(nonce []byte, plaintext []byte) []byte {
	hasher := sha512.New()
	hasher.Write(nonce)
	hasher.Write(plaintext)

	var buf bytes.Buffer
	writeNullTerminatedString(&buf, SaltPackFormatName)
	writeNullTerminatedString(&buf, SignatureDetachedString)
	buf.Write(hasher.Sum(nil))

	return buf.Bytes()
}
