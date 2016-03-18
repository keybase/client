// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"io"
)

type verifyStream struct {
	stream     *msgpackStream
	state      readState
	buffer     []byte
	header     *SignatureHeader
	headerHash []byte
	publicKey  SigningPublicKey
	seqno      packetSeqno
}

func newVerifyStream(r io.Reader, msgType MessageType) (*verifyStream, error) {
	s := &verifyStream{
		stream: newMsgpackStream(r),
		seqno:  0,
	}
	err := s.readHeader(msgType)
	if err != nil {
		return nil, err
	}
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

func (v *verifyStream) readHeader(msgType MessageType) error {
	var headerBytes []byte
	_, err := v.stream.Read(&headerBytes)
	if err != nil {
		return err
	}

	v.headerHash = sha512OfSlice(headerBytes)

	var header SignatureHeader
	err = decodeFromBytes(&header, headerBytes)
	if err != nil {
		return err
	}
	v.header = &header
	if err := header.validate(msgType); err != nil {
		return err
	}
	v.state = stateBody
	return nil
}

func (v *verifyStream) readBlock(p []byte) (int, bool, error) {
	var block signatureBlock
	_, err := v.stream.Read(&block)
	if err != nil {
		return 0, false, err
	}
	block.seqno = v.seqno
	v.seqno++

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

func (v *verifyStream) processBlock(block *signatureBlock) ([]byte, error) {
	if err := v.publicKey.Verify(attachedSignatureInput(v.headerHash, block), block.Signature); err != nil {
		return nil, err
	}
	return block.PayloadChunk, nil
}
