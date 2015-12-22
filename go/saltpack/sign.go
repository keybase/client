// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// NewSignStream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.
func NewSignStream(signedtext io.Writer, signer SigningSecretKey, mode MessageType) (stream io.WriteCloser, err error) {
	switch mode {
	case MessageTypeAttachedSignature:
		return newSignAttachedStream(signedtext, signer)
	case MessageTypeDetachedSignature:
		return nil, errors.New("detached not yet implemented")
	default:
		return nil, ErrInvalidParameter{message: fmt.Sprintf("unknown sign mode: %v", mode)}
	}
}

// Sign signs a plaintext from signer.
func Sign(plaintext []byte, signer SigningSecretKey, mode MessageType) ([]byte, error) {
	var buf bytes.Buffer
	s, err := NewSignStream(&buf, signer, mode)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, ErrNoStream
	}
	if _, err := s.Write(plaintext); err != nil {
		return nil, err
	}
	if err := s.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type signAttachedStream struct {
	header      *SignatureHeader
	wroteHeader bool
	encoder     encoder
	buffer      bytes.Buffer
	block       []byte
	seqno       PacketSeqno
	secretKey   SigningSecretKey
}

func newSignAttachedStream(w io.Writer, signer SigningSecretKey) (*signAttachedStream, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}

	header, err := newSignatureHeader(signer.PublicKey())
	if err != nil {
		return nil, err
	}

	stream := &signAttachedStream{
		header:    header,
		encoder:   newEncoder(w),
		block:     make([]byte, SignatureBlockSize),
		secretKey: signer,
	}

	return stream, nil
}

func (s *signAttachedStream) Write(p []byte) (int, error) {
	if !s.wroteHeader {
		s.wroteHeader = true
		if err := s.encoder.Encode(s.header); err != nil {
			return 0, err
		}

		// this doesn't follow the spec, but I think header should have seqno=0, first packet should have seqno=1.
		// spec says header has seqno=0, first packet has seqno=0.
		s.seqno++
	}

	n, err := s.buffer.Write(p)
	if err != nil {
		return 0, err
	}

	for s.buffer.Len() >= SignatureBlockSize {
		if err := s.signBlock(); err != nil {
			return 0, err
		}
	}

	return n, nil
}

func (s *signAttachedStream) Close() error {
	for s.buffer.Len() > 0 {
		if err := s.signBlock(); err != nil {
			return err
		}
	}
	return s.writeFooter()
}

func (s *signAttachedStream) signBlock() error {
	n, err := s.buffer.Read(s.block[:])
	if err != nil {
		return err
	}
	return s.signBytes(s.block[:n])
}

func (s *signAttachedStream) signBytes(b []byte) error {
	block := SignatureBlock{
		PayloadChunk: b,
		seqno:        s.seqno,
	}
	sig, err := s.computeSig(&block)
	if err != nil {
		return err
	}
	block.Signature = sig

	if err := s.encoder.Encode(block); err != nil {
		return err
	}

	s.seqno++
	return nil
}

func (s *signAttachedStream) writeFooter() error {
	return s.signBytes([]byte{})
}

func (s *signAttachedStream) computeSig(block *SignatureBlock) ([]byte, error) {
	return s.secretKey.Sign(computeSigDigest(s.header.Nonce, block))
}

func computeSigDigest(nonce []byte, block *SignatureBlock) []byte {
	hasher := sha512.New()
	hasher.Write(nonce)
	binary.Write(hasher, binary.BigEndian, block.seqno)
	hasher.Write(block.PayloadChunk)

	var buf bytes.Buffer
	buf.Write(hasher.Sum(nil))
	writeNullString(&buf, SaltPackFormatName)
	writeNullString(&buf, SignatureAttachedString)

	return buf.Bytes()
}
