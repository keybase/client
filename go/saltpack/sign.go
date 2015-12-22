// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"encoding/binary"
	"io"
)

// NewSignStream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.  NewSignStream only generates attached signatures.
func NewSignStream(signedtext io.Writer, signer SigningSecretKey) (stream io.WriteCloser, err error) {
	return newSignAttachedStream(signedtext, signer)
}

// Sign creates an attached signature message of plaintext from signer.
func Sign(plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	var buf bytes.Buffer
	s, err := NewSignStream(&buf, signer)
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

// SignDetached returns a detached signature of plaintext from
// signer.
func SignDetached(plaintext []byte, signer SigningSecretKey) ([]byte, error) {
	header, err := newSignatureHeader(signer.PublicKey(), MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	signature, err := signer.Sign(computeDetachedDigest(header.Nonce, plaintext))
	if err != nil {
		return nil, err
	}
	header.Signature = signature

	return encodeToBytes(header)
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

	header, err := newSignatureHeader(signer.PublicKey(), MessageTypeAttachedSignature)
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
	return s.secretKey.Sign(computeAttachedDigest(s.header.Nonce, block))
}

func computeAttachedDigest(nonce []byte, block *SignatureBlock) []byte {
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

func computeDetachedDigest(nonce []byte, plaintext []byte) []byte {
	hasher := sha512.New()
	hasher.Write(nonce)
	hasher.Write(plaintext)

	var buf bytes.Buffer
	buf.Write(hasher.Sum(nil))
	writeNullString(&buf, SaltPackFormatName)
	writeNullString(&buf, SignatureDetachedString)

	return buf.Bytes()
}
