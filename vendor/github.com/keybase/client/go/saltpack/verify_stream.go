// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "io"

type verifyStream struct {
	stream    *msgpackStream
	state     readState
	buffer    []byte
	header    *SignatureHeader
	publicKey SigningPublicKey
}

func newVerifyStream(r io.Reader, msgType MessageType) (*verifyStream, error) {
	s := &verifyStream{
		stream: newMsgpackStream(r),
	}
	hdr, err := s.readHeader(msgType)
	if err != nil {
		return nil, err
	}
	s.header = hdr
	// reset the seqno on the stream after reading the header
	s.stream.seqno = 0
	return s, nil
}

func (v *verifyStream) Read(p []byte) (n int, err error) {
	if v.state == stateEndOfStream {
		return 0, io.EOF
	}

	for n == 0 && err == nil {
		n, err = v.read(p)
	}
	if err == io.EOF && v.state != stateEndOfStream {
		err = io.ErrUnexpectedEOF
	}
	return n, err
}

func (v *verifyStream) read(p []byte) (int, error) {
	// if data in the buffer, then start by copying it into output slice
	if len(v.buffer) > 0 {
		n := copy(p, v.buffer)
		v.buffer = v.buffer[n:]
		return n, nil
	}

	n, last, err := v.readBlock(p)
	if err != nil {
		return n, err
	}
	if last {
		v.state = stateEndOfStream
		if err := assertEndOfStream(v.stream); err != nil {
			return n, err
		}
	}

	return n, nil
}

func (v *verifyStream) readHeader(msgType MessageType) (*SignatureHeader, error) {
	var hdr SignatureHeader
	seqno, err := v.stream.Read(&hdr)
	if err != nil {
		return nil, err
	}
	hdr.seqno = seqno
	v.header = &hdr
	if err := v.header.validate(msgType); err != nil {
		return nil, err
	}
	v.state = stateBody
	return &hdr, nil
}

func (v *verifyStream) readBlock(p []byte) (int, bool, error) {
	var block SignatureBlock
	seqno, err := v.stream.Read(&block)
	if err != nil {
		return 0, false, err
	}
	block.seqno = seqno

	data, err := v.processBlock(&block)
	if err != nil {
		return 0, false, err
	}
	if data == nil || len(data) == 0 {
		return 0, true, err
	}

	n := copy(p, data)
	v.buffer = data[n:]

	return n, false, err
}

func (v *verifyStream) processBlock(block *SignatureBlock) ([]byte, error) {
	if err := v.publicKey.Verify(computeAttachedDigest(v.header.Nonce, block), block.Signature); err != nil {
		return nil, err
	}
	return block.PayloadChunk, nil
}
