// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"fmt"
	"io"
)

type testSignOptions struct {
	corruptHeader      func(sh *SignatureHeader)
	corruptHeaderBytes func(bytes *[]byte)
	swapBlock          bool
	skipBlock          func(blockNum packetSeqno) bool
	skipFooter         bool
}

type testSignStream struct {
	version    Version
	headerHash headerHash
	encoder    encoder
	buffer     bytes.Buffer
	seqno      packetSeqno
	secretKey  SigningSecretKey
	options    testSignOptions
	savedBlock interface{}
}

func newTestSignStream(version Version, w io.Writer, signer SigningSecretKey, opts testSignOptions) (*testSignStream, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}

	header, err := newSignatureHeader(version, signer.GetPublicKey(), MessageTypeAttachedSignature)
	if err != nil {
		return nil, err
	}
	if opts.corruptHeader != nil {
		opts.corruptHeader(header)
	}

	// Encode the header bytes.
	headerBytes, err := encodeToBytes(header)
	if err != nil {
		return nil, err
	}
	if opts.corruptHeaderBytes != nil {
		opts.corruptHeaderBytes(&headerBytes)
	}

	// Compute the header hash.
	headerHash := hashHeader(headerBytes)

	stream := &testSignStream{
		version:    version,
		headerHash: headerHash,
		encoder:    newEncoder(w),
		secretKey:  signer,
		options:    opts,
	}

	// Double encode the header bytes onto the wire.
	err = stream.encoder.Encode(headerBytes)
	if err != nil {
		return nil, err
	}

	return stream, nil
}

func (s *testSignStream) Write(p []byte) (int, error) {
	n, err := s.buffer.Write(p)
	if err != nil {
		return 0, err
	}

	// If s.buffer.Len() == signatureBlockSize, we don't want to
	// write it out just yet, since for V2 we need to be sure this
	// isn't the last block.
	for s.buffer.Len() > signatureBlockSize {
		if err := s.signBlock(false); err != nil {
			return 0, err
		}
	}

	return n, nil
}

func (s *testSignStream) Close() error {
	switch s.version {
	case Version1():
		if s.buffer.Len() > 0 {
			if err := s.signBlock(false); err != nil {
				return err
			}
		}

		if s.buffer.Len() > 0 {
			panic(fmt.Sprintf("s.buffer.Len()=%d > 0", s.buffer.Len()))
		}

		if s.options.skipFooter {
			return nil
		}

		return s.signBlock(true)

	case Version2():
		isFinal := true

		if s.options.skipFooter {
			isFinal = false
		}

		if err := s.signBlock(isFinal); err != nil {
			return err
		}

		if s.buffer.Len() > 0 {
			panic(fmt.Sprintf("s.buffer.Len()=%d > 0", s.buffer.Len()))
		}

		return nil

	default:
		panic(ErrBadVersion{s.version})
	}
}

func (s *testSignStream) signBlock(isFinal bool) error {
	chunk := s.buffer.Next(signatureBlockSize)
	checkSignBlockRead(s.version, isFinal, signatureBlockSize, len(chunk), s.buffer.Len())

	sig, err := s.computeSig(chunk, s.seqno, isFinal)
	if err != nil {
		return err
	}

	assertEncodedChunkState(s.version, chunk, 0, uint64(s.seqno), isFinal)

	sBlock := makeSignatureBlock(s.version, sig, chunk, isFinal)

	if s.options.swapBlock {
		if s.seqno == 0 {
			s.savedBlock = sBlock
			s.seqno++
			return nil
		}
	}

	if s.options.skipBlock == nil || !s.options.skipBlock(s.seqno) {
		if err := s.encoder.Encode(sBlock); err != nil {
			return err
		}
		s.seqno++
	}

	if s.options.swapBlock {
		if s.savedBlock != nil {
			if err := s.encoder.Encode(s.savedBlock); err != nil {
				return err
			}
			s.savedBlock = nil
			return nil
		}
	}

	return nil
}

func (s *testSignStream) computeSig(payloadChunk []byte, seqno packetSeqno, isFinal bool) ([]byte, error) {
	return s.secretKey.Sign(attachedSignatureInput(s.version, s.headerHash, payloadChunk, seqno, isFinal))
}

func testTweakSign(version Version, plaintext []byte, signer SigningSecretKey, opts testSignOptions) ([]byte, error) {
	var buf bytes.Buffer
	s, err := newTestSignStream(version, &buf, signer, opts)
	if err != nil {
		return nil, err
	}
	if _, err := s.Write(plaintext); err != nil {
		return nil, err
	}
	if err := s.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func testTweakSignDetached(version Version, plaintext []byte, signer SigningSecretKey, opts testSignOptions) ([]byte, error) {
	if signer == nil {
		return nil, ErrInvalidParameter{message: "no signing key provided"}
	}
	header, err := newSignatureHeader(version, signer.GetPublicKey(), MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}

	if opts.corruptHeader != nil {
		opts.corruptHeader(header)
	}

	// Encode the header bytes.
	headerBytes, err := encodeToBytes(header)
	if err != nil {
		return nil, err
	}

	// Compute the header hash.
	headerHash := hashHeader(headerBytes)

	// Double encode the header bytes to start the output.
	output, err := encodeToBytes(headerBytes)
	if err != nil {
		return nil, err
	}

	// Sign the plaintext.
	signature, err := signer.Sign(detachedSignatureInput(headerHash, plaintext))
	if err != nil {
		return nil, err
	}

	// Append the encoded signature to the output.
	encodedSig, err := encodeToBytes(signature)
	if err != nil {
		return nil, err
	}
	output = append(output, encodedSig...)

	return output, nil
}
