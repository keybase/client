// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"fmt"

	"github.com/keybase/go-codec/codec"
)

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

func (v Version) String() string {
	return fmt.Sprintf("%d.%d", v.Major, v.Minor)
}

// TODO: Check FormatName in the various Header.validate() functions.

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
}

// encryptionBlockV1 contains a block of encrypted data. It contains
// the ciphertext, and any necessary authentication Tags.
type encryptionBlockV1 struct {
	_struct            bool                   `codec:",toarray"`
	HashAuthenticators []payloadAuthenticator `codec:"authenticators"`
	PayloadCiphertext  []byte                 `codec:"ctext"`
}

// encryptionBlockV2 is encryptionBlockV1, but with a flag signifying
// whether or not this is the final packet.
type encryptionBlockV2 struct {
	encryptionBlockV1
	IsFinal bool `codec:"final"`
}

// Make *encryptionBlockV2 implement codec.Selfer to encode IsFinal
// first, to preserve the behavior noticed in this issue:
// https://github.com/keybase/saltpack/pull/43 .

var _ codec.Selfer = (*encryptionBlockV2)(nil)

func (b *encryptionBlockV2) CodecEncodeSelf(e *codec.Encoder) {
	e.MustEncode([]interface{}{
		b.IsFinal,
		b.HashAuthenticators,
		b.PayloadCiphertext,
	})
}

func (b *encryptionBlockV2) CodecDecodeSelf(d *codec.Decoder) {
	d.MustDecode([]interface{}{
		&b.IsFinal,
		&b.HashAuthenticators,
		&b.PayloadCiphertext,
	})
}

func (h *EncryptionHeader) validate(versionValidator func(Version) error) error {
	if h.Type != MessageTypeEncryption {
		return ErrWrongMessageType{MessageTypeEncryption, h.Type}
	}
	return versionValidator(h.Version)
}

// The SigncryptionHeader has exactly the same structure as the
// EncryptionHeader, though the byte slices represent different types of keys.
type SigncryptionHeader EncryptionHeader

// signcryptionBlock contains a block of signed and encrypted data.
type signcryptionBlock struct {
	_struct           bool   `codec:",toarray"`
	PayloadCiphertext []byte `codec:"ctext"`
	IsFinal           bool   `codec:"final"`
}

func (h *SigncryptionHeader) validate() error {
	if h.Type != MessageTypeSigncryption {
		return ErrWrongMessageType{MessageTypeSigncryption, h.Type}
	}
	if h.Version.Major != Version2().Major {
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

func newSignatureHeader(version Version, sender SigningPublicKey, msgType MessageType) (*SignatureHeader, error) {
	if sender == nil {
		return nil, ErrInvalidParameter{message: "no public signing key provided"}
	}
	nonce, err := newSigNonce()
	if err != nil {
		return nil, err
	}

	header := &SignatureHeader{
		FormatName:   FormatName,
		Version:      version,
		Type:         msgType,
		SenderPublic: sender.ToKID(),
		Nonce:        nonce[:],
	}

	return header, nil
}

func (h *SignatureHeader) validate(versionValidator VersionValidator, msgType MessageType) error {
	if err := versionValidator(h.Version); err != nil {
		return err
	}

	if h.Type != msgType {
		return ErrWrongMessageType{
			wanted:   msgType,
			received: h.Type,
		}
	}

	if msgType != MessageTypeAttachedSignature && msgType != MessageTypeDetachedSignature {
		return ErrInvalidParameter{message: fmt.Sprintf("signature header must be MessageTypeAttachedSignature or MessageTypeDetachedSignature, not %d", msgType)}
	}

	return nil
}

// signatureBlockV1 contains a block of signed data.
type signatureBlockV1 struct {
	_struct      bool   `codec:",toarray"`
	Signature    []byte `codec:"signature"`
	PayloadChunk []byte `codec:"payload_chunk"`
}

// signatureBlockV2 is signatureBlockV1, but with a flag signifying
// whether or not this is the final packet.
type signatureBlockV2 struct {
	signatureBlockV1
	IsFinal bool `codec:"final"`
}

// Make *signatureBlockV2 implement codec.Selfer to encode IsFinal
// first, to preserve the behavior noticed in this issue:
// https://github.com/keybase/saltpack/pull/43 .

var _ codec.Selfer = (*signatureBlockV2)(nil)

func (b *signatureBlockV2) CodecEncodeSelf(e *codec.Encoder) {
	e.MustEncode([]interface{}{
		b.IsFinal,
		b.Signature,
		b.PayloadChunk,
	})
}

func (b *signatureBlockV2) CodecDecodeSelf(d *codec.Decoder) {
	d.MustDecode([]interface{}{
		&b.IsFinal,
		&b.Signature,
		&b.PayloadChunk,
	})
}
