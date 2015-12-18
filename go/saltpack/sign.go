// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
)

// NewSignStream creates a stream that consumes plaintext data.
// It will write out signed data to the io.Writer passed in as
// signedtext.
func NewSignStream(signedtext io.Writer, sender BoxSecretKey, mode MessageType) (stream io.WriteCloser, err error) {
	return &signStream{}, nil
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

type signStream struct{}

func (s *signStream) Write([]byte) (int, error) {
	return 0, nil
}

func (s *signStream) Close() error {
	return nil
}
