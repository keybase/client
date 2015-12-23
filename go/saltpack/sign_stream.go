// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
)

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
