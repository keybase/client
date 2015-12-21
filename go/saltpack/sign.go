// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"errors"
	"fmt"
	"io"
)

// NewSignStream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.
func NewSignStream(signedtext io.Writer, sender BoxSecretKey, mode MessageType) (stream io.WriteCloser, err error) {
	switch mode {
	case MessageTypeAttachedSignature:
		return newSignAttachedStream(signedtext, sender)
	case MessageTypeDetachedSignature:
		return nil, errors.New("detached not yet implemented")
	default:
		return nil, ErrInvalidParameter{message: fmt.Sprintf("unknown sign mode: %v", mode)}
	}
}

// Sign signs a plaintext from sender.
func Sign(plaintext []byte, sender BoxSecretKey, mode MessageType) ([]byte, error) {
	var buf bytes.Buffer
	s, err := NewSignStream(&buf, sender, mode)
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
}

func newSignAttachedStream(w io.Writer, sender BoxSecretKey) (*signAttachedStream, error) {
	if sender == nil {
		return nil, ErrInvalidParameter{message: "no sender key provided"}
	}

	header, err := newSignatureHeader(sender.GetPublicKey())
	if err != nil {
		return nil, err
	}

	stream := &signAttachedStream{
		header:  header,
		encoder: newEncoder(w),
		block:   make([]byte, SignatureBlockSize),
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
	}
	return s.encoder.Encode(block)
}

func (s *signAttachedStream) writeFooter() error {
	return s.signBytes([]byte{})
}
