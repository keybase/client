// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"hash"
	"io"
)

type signAttachedStream struct {
	headerHash []byte
	encoder    encoder
	buffer     bytes.Buffer
	block      []byte
	seqno      packetSeqno
	secretKey  SigningSecretKey
}

func newSignAttachedStream(w io.Writer, signer SigningSecretKey) (*signAttachedStream, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}

	header, err := newSignatureHeader(signer.GetPublicKey(), MessageTypeAttachedSignature)
	if err != nil {
		return nil, err
	}

	// Encode the header bytes.
	headerBytes, err := encodeToBytes(header)
	if err != nil {
		return nil, err
	}

	// Compute the header hash.
	headerHash := sha512OfSlice(headerBytes)

	// Create the attached stream object.
	stream := &signAttachedStream{
		headerHash: headerHash,
		encoder:    newEncoder(w),
		block:      make([]byte, signatureBlockSize),
		secretKey:  signer,
	}

	// Double encode the header bytes onto the wire.
	err = stream.encoder.Encode(headerBytes)
	if err != nil {
		return nil, err
	}

	return stream, nil
}

func (s *signAttachedStream) Write(p []byte) (int, error) {
	n, err := s.buffer.Write(p)
	if err != nil {
		return 0, err
	}

	for s.buffer.Len() >= signatureBlockSize {
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
	block := signatureBlock{
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

func (s *signAttachedStream) computeSig(block *signatureBlock) ([]byte, error) {
	return s.secretKey.Sign(attachedSignatureInput(s.headerHash, block))
}

type signDetachedStream struct {
	encoder   encoder
	secretKey SigningSecretKey
	hasher    hash.Hash
}

func newSignDetachedStream(w io.Writer, signer SigningSecretKey) (*signDetachedStream, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}

	header, err := newSignatureHeader(signer.GetPublicKey(), MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	// Encode the header bytes.
	headerBytes, err := encodeToBytes(header)
	if err != nil {
		return nil, err
	}

	// Compute the header hash.
	headerHash := sha512OfSlice(headerBytes)

	// Create the detached stream object.
	stream := &signDetachedStream{
		encoder:   newEncoder(w),
		secretKey: signer,
		hasher:    sha512.New(),
	}

	// Double encode the header bytes onto the wire.
	err = stream.encoder.Encode(headerBytes)
	if err != nil {
		return nil, err
	}

	// Start off the message digest with the header hash. Subsequent calls to
	// Write() will push message bytes into this digest.
	stream.hasher.Write(headerHash)

	return stream, nil
}

func (s *signDetachedStream) Write(p []byte) (int, error) {
	return s.hasher.Write(p)
}

func (s *signDetachedStream) Close() error {
	signature, err := s.secretKey.Sign(detachedSignatureInputFromHash(s.hasher.Sum(nil)))
	if err != nil {
		return err
	}

	return s.encoder.Encode(signature)
}
