// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"io"
)

type verifyStream struct {
	mps        *msgpackStream
	header     *SignatureHeader
	headerHash headerHash
	publicKey  SigningPublicKey
}

func newVerifyStream(versionValidator VersionValidator, r io.Reader, msgType MessageType) (*verifyStream, error) {
	s := &verifyStream{
		mps: newMsgpackStream(r),
	}
	err := s.readHeader(versionValidator, msgType)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (v *verifyStream) getNextChunk() ([]byte, error) {
	signature, chunk, isFinal, seqno, err := readSignatureBlock(v.header.Version, v.mps)
	if err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return nil, err
	}

	err = v.processBlock(signature, chunk, isFinal, seqno)
	if err != nil {
		return nil, err
	}

	err = checkDecodedChunkState(v.header.Version, chunk, seqno, isFinal)
	if err != nil {
		return nil, err
	}

	if isFinal {
		return chunk, assertEndOfStream(v.mps)
	}

	return chunk, nil
}

func (v *verifyStream) readHeader(versionValidator VersionValidator, msgType MessageType) error {
	var headerBytes []byte
	_, err := v.mps.Read(&headerBytes)
	if err != nil {
		return ErrFailedToReadHeaderBytes
	}

	v.headerHash = hashHeader(headerBytes)

	var header SignatureHeader
	err = decodeFromBytes(&header, headerBytes)
	if err != nil {
		return err
	}
	if err := header.validate(versionValidator, msgType); err != nil {
		return err
	}

	v.header = &header
	return nil
}

func readSignatureBlock(version Version, mps *msgpackStream) (signature, payloadChunk []byte, isFinal bool, seqno packetSeqno, err error) {
	switch version.Major {
	case 1:
		var sbV1 signatureBlockV1
		seqno, err = mps.Read(&sbV1)
		if err != nil {
			return nil, nil, false, 0, err
		}

		return sbV1.Signature, sbV1.PayloadChunk, len(sbV1.PayloadChunk) == 0, seqno, nil
	case 2:
		var sbV2 signatureBlockV2
		seqno, err = mps.Read(&sbV2)
		if err != nil {
			return nil, nil, false, 0, err
		}

		return sbV2.Signature, sbV2.PayloadChunk, sbV2.IsFinal, seqno, nil
	default:
		panic(ErrBadVersion{version})
	}
}

func (v *verifyStream) processBlock(signature, payloadChunk []byte, isFinal bool, seqno packetSeqno) error {
	return v.publicKey.Verify(attachedSignatureInput(v.header.Version, v.headerHash, payloadChunk, seqno-1, isFinal), signature)
}
