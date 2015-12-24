// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "fmt"

type receiverKeysPlaintext struct {
	_struct    bool   `codec:",toarray"`
	Sender     []byte `codec:"sender"`
	SessionKey []byte `codec:"session_key"`
}

type receiverKeysCiphertexts struct {
	_struct     bool   `codec:",toarray"`
	ReceiverKID []byte `codec:"receiver_key_id"`
	Keys        []byte `codec:"keys"`
}

// Version is a major.minor pair that shows the version of the whole file
type Version struct {
	_struct bool `codec:",toarray"`
	Major   int  `codec:"major"`
	Minor   int  `codec:"minor"`
}

// EncryptionHeader is the first packet in an encrypted message.
// It contains the encryptions of the session keys, and various
// message metadata.
type EncryptionHeader struct {
	_struct    bool                      `codec:",toarray"`
	FormatName string                    `codec:"format_name"`
	Version    Version                   `codec:"vers"`
	Type       MessageType               `codec:"type"`
	Sender     []byte                    `codec:"sender"`
	Receivers  []receiverKeysCiphertexts `codec:"rcvrs"`
	seqno      PacketSeqno
}

// EncryptionBlock contains a block of encrypted data. It contains
// the ciphertext, and any necessary authentication Tags.
type EncryptionBlock struct {
	_struct            bool     `codec:",toarray"`
	HashAuthenticators [][]byte `codec:"authenticators"`
	PayloadCiphertext  []byte   `codec:"ctext"`
	seqno              PacketSeqno
}

func verifyRawKey(k []byte) error {
	if len(k) != len(RawBoxKey{}) {
		return ErrBadSenderKey
	}
	return nil
}

func (h *EncryptionHeader) validate() error {
	if h.Type != MessageTypeEncryption {
		return ErrWrongMessageType{MessageTypeEncryption, h.Type}
	}
	if h.Version.Major != SaltPackCurrentVersion.Major {
		return ErrBadVersion{h.seqno, h.Version}
	}
	return nil
}

// SignatureHeader is the first packet in a signed message.
type SignatureHeader struct {
	_struct      bool        `codec:",toarray"`
	FormatName   string      `codec:"format_name"`
	Version      Version     `codec:"vers"`
	Type         MessageType `codec:"type"`
	SenderPublic []byte      `codec:"sender_public"`
	Nonce        []byte      `codec:"nonce"`
	Signature    []byte      `codec:"signature,omitempty"`
	seqno        PacketSeqno
}

func newSignatureHeader(sender SigningPublicKey, msgType MessageType) (*SignatureHeader, error) {
	if sender == nil {
		return nil, ErrInvalidParameter{message: "no public signing key provided"}
	}
	nonce, err := NewSigNonce()
	if err != nil {
		return nil, err
	}

	header := &SignatureHeader{
		FormatName:   SaltPackFormatName,
		Version:      SaltPackCurrentVersion,
		Type:         msgType,
		SenderPublic: sender.ToKID(),
		Nonce:        nonce[:],
	}

	return header, nil
}

func (h *SignatureHeader) validate(msgType MessageType) error {
	if h.Type != msgType {
		return ErrWrongMessageType{
			wanted:   msgType,
			received: h.Type,
		}
	}
	if h.Version.Major != SaltPackCurrentVersion.Major {
		return ErrBadVersion{h.seqno, h.Version}
	}

	if msgType == MessageTypeAttachedSignature {
		if len(h.Signature) != 0 {
			return ErrDetachedSignaturePresent
		}
	} else if msgType == MessageTypeDetachedSignature {
		if len(h.Signature) == 0 {
			return ErrNoDetachedSignature
		}
	} else {
		return ErrInvalidParameter{message: fmt.Sprintf("signature header must be MessageTypeAttachedSignature or MessageTypeDetachedSignature, not %d", msgType)}
	}

	return nil
}

// SignatureBlock contains a block of signed data.
type SignatureBlock struct {
	_struct      bool   `codec:",toarray"`
	Signature    []byte `codec:"signature"`
	PayloadChunk []byte `codec:"payload_chunk"`
	seqno        PacketSeqno
}
