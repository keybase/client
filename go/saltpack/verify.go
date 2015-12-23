// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"io/ioutil"
)

// NewVerifyStream creates a stream that consumes data from reader
// r.  It returns the signer's public key and a reader that only
// contains verified data.  If the signer's key is not in keyring,
// it will return an error.
func NewVerifyStream(r io.Reader, keyring SigKeyring) (skey SigningPublicKey, vs io.Reader, err error) {
	s := newVerifyStream(r)
	hdr, err := s.readHeader(MessageTypeAttachedSignature)
	if err != nil {
		return nil, nil, err
	}
	skey = keyring.LookupSigningPublicKey(hdr.SenderPublic)
	if skey == nil {
		return nil, nil, ErrNoSenderKey
	}
	s.publicKey = skey
	return skey, s, nil
}

// Verify checks the signature in signedMsg.  It returns the
// signer's public key and a verified message.
func Verify(signedMsg []byte, keyring SigKeyring) (skey SigningPublicKey, verifiedMsg []byte, err error) {
	skey, stream, err := NewVerifyStream(bytes.NewReader(signedMsg), keyring)
	if err != nil {
		return nil, nil, err
	}
	if stream == nil {
		return nil, nil, ErrNoStream
	}
	if skey == nil {
		return nil, nil, ErrNoSenderKey
	}

	verifiedMsg, err = ioutil.ReadAll(stream)
	if err != nil {
		return nil, nil, err
	}
	return skey, verifiedMsg, nil
}

// VerifyDetached verifies that signature is a valid signature for
// message, and that the public key for the signer is in keyring.
// It returns the signer's public key.
func VerifyDetached(message, signature []byte, keyring SigKeyring) (skey SigningPublicKey, err error) {
	s := newVerifyStream(bytes.NewBuffer(signature))
	hdr, err := s.readHeader(MessageTypeDetachedSignature)
	if err != nil {
		return nil, err
	}
	if len(hdr.Signature) == 0 {
		return nil, ErrNoDetachedSignature
	}
	skey = keyring.LookupSigningPublicKey(hdr.SenderPublic)
	if skey == nil {
		return nil, ErrNoSenderKey
	}

	if err := skey.Verify(computeDetachedDigest(hdr.Nonce, message), hdr.Signature); err != nil {
		return nil, err
	}

	return skey, nil
}

type verifyStream struct {
	stream    *msgpackStream
	state     readState
	buffer    []byte
	header    *SignatureHeader
	publicKey SigningPublicKey
}

func newVerifyStream(r io.Reader) *verifyStream {
	return &verifyStream{
		stream: newMsgpackStream(r),
	}
}

func (v *verifyStream) Read(p []byte) (n int, err error) {
	if v.state == stateHeader {
		return 0, ErrHeaderNotRead
	}
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
