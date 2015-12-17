// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import ()

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

// EncryptionBlock contains a block of encrypted data. It cointains
// the ciphertext, and any necessary authentication Tags.
type EncryptionBlock struct {
	_struct           bool     `codec:",toarray"`
	TagCiphertexts    [][]byte `codec:"tags"`
	PayloadCiphertext []byte   `codec:"ctext"`
	seqno             PacketSeqno
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
