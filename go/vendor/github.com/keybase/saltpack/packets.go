// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "fmt"

type receiverKeys struct {
	_struct       bool   `codec:",toarray"`
	ReceiverKID   []byte `codec:"receiver_key_id"`
	PayloadKeyBox []byte `codec:"payloadkey"`
}

// Version is a major.minor pair that shows the version of the whole file
type Version struct {
	_struct bool `codec:",toarray"`
	Major   int  `codec:"major"`
	Minor   int  `codec:"minor"`
}

// EncryptionHeader is the first packet in an encrypted message. It contains
// the encryptions of the session key, and various message metadata. This same
// struct is used for the signcryption mode as well, though the key types
// represented by the []byte arrays are different. (For example in the
// signcryption mode, the sender secretbox contains a *signing* key instead of
// an encryption key, and the receiver identifier takes a different form.)
type EncryptionHeader struct {
	_struct         bool           `codec:",toarray"`
	FormatName      string         `codec:"format_name"`
	Version         Version        `codec:"vers"`
	Type            MessageType    `codec:"type"`
	Ephemeral       []byte         `codec:"ephemeral"`
	SenderSecretbox []byte         `codec:"sendersecretbox"`
	Receivers       []receiverKeys `codec:"rcvrs"`
	seqno           packetSeqno
}

// encryptionBlock contains a block of encrypted data. It contains
// the ciphertext, and any necessary authentication Tags.
type encryptionBlock struct {
	_struct            bool     `codec:",toarray"`
	HashAuthenticators [][]byte `codec:"authenticators"`
	PayloadCiphertext  []byte   `codec:"ctext"`
	seqno              packetSeqno
}

func (h *EncryptionHeader) validate() error {
	if h.Type != MessageTypeEncryption {
		return ErrWrongMessageType{MessageTypeEncryption, h.Type}
	}
	if h.Version.Major != SaltpackCurrentVersion.Major {
		return ErrBadVersion{h.Version}
	}
	return nil
}

// The SigncryptionHeader has exactly the same structure as the
// EncryptionHeader, though the byte slices represent different types of keys.
type SigncryptionHeader EncryptionHeader

// signcryptionBlock contains a block of signed and encrypted data.
type signcryptionBlock struct {
	_struct           bool   `codec:",toarray"`
	PayloadCiphertext []byte `codec:"ctext"`
	seqno             packetSeqno
}

func (h *SigncryptionHeader) validate() error {
	if h.Type != MessageTypeSigncryption {
		return ErrWrongMessageType{MessageTypeSigncryption, h.Type}
	}
	if h.Version.Major != SaltpackVersion2.Major {
		return ErrBadVersion{h.Version}
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
}

func newSignatureHeader(sender SigningPublicKey, msgType MessageType) (*SignatureHeader, error) {
	if sender == nil {
		return nil, ErrInvalidParameter{message: "no public signing key provided"}
	}
	nonce, err := newSigNonce()
	if err != nil {
		return nil, err
	}

	header := &SignatureHeader{
		FormatName:   SaltpackFormatName,
		Version:      SaltpackCurrentVersion,
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
	if h.Version.Major != SaltpackCurrentVersion.Major {
		return ErrBadVersion{h.Version}
	}

	if msgType != MessageTypeAttachedSignature && msgType != MessageTypeDetachedSignature {
		return ErrInvalidParameter{message: fmt.Sprintf("signature header must be MessageTypeAttachedSignature or MessageTypeDetachedSignature, not %d", msgType)}
	}

	return nil
}

// signatureBlock contains a block of signed data.
type signatureBlock struct {
	_struct      bool   `codec:",toarray"`
	Signature    []byte `codec:"signature"`
	PayloadChunk []byte `codec:"payload_chunk"`
	seqno        packetSeqno
}
