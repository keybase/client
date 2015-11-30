// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import ()

type receiverKeysPlaintext struct {
	GroupID    uint32 `codec:"gid"`
	MACKey     []byte `codec:"mac,omitempty"`
	SessionKey []byte `codec:"sess"`
}

type receiverKeysCiphertexts struct {
	KID    []byte `codec:"key_id,omitempty"`
	Keys   []byte `codec:"keys"`
	Sender []byte `codec:"sender"`
}

// EncryptionHeader is the first packet in an encrypted message.
// It contains the encryptions of the session keys, and various
// message metadata.
type EncryptionHeader struct {
	Nonce     []byte                    `codec:"nonce"`
	Receivers []receiverKeysCiphertexts `codec:"rcvrs"`
	Sender    []byte                    `codec:"sender"`
	Tag       PacketTag                 `codec:"tag"`
	Version   PacketVersion             `codec:"vers"`
	seqno     PacketSeqno
}

// EncryptionBlock contains a block of encrypted data. It cointains
// the ciphertext, and any necessary MACs.
type EncryptionBlock struct {
	Ciphertext []byte        `codec:"ctext"`
	MACs       [][]byte      `codec:"macs"`
	Tag        PacketTag     `codec:"tag"`
	Version    PacketVersion `codec:"vers"`
	seqno      PacketSeqno
}

func verifyRawKey(k []byte) error {
	if len(k) != len(RawBoxKey{}) {
		return ErrBadSenderKey
	}
	return nil
}

func (h *EncryptionHeader) validate() error {
	if h.Tag != PacketTagEncryptionHeader {
		return ErrWrongPacketTag{h.seqno, PacketTagEncryptionHeader, h.Tag}
	}
	if h.Version != PacketVersion1 {
		return ErrBadVersion{h.seqno, h.Version}
	}
	// We leave off 4 bytes of the nonce, since it's a counter
	// incremented for each public key
	if len(h.Nonce) != len(Nonce{})-4 {
		return ErrBadNonce{h.seqno, len(h.Nonce)}
	}

	if err := verifyRawKey(h.Sender); err != nil {
		return err
	}

	return nil
}

func (b *EncryptionBlock) validate() error {
	if b.Tag != PacketTagEncryptionBlock {
		return ErrWrongPacketTag{b.seqno, PacketTagEncryptionBlock, b.Tag}
	}
	if b.Version != PacketVersion1 {
		return ErrBadVersion{b.seqno, b.Version}
	}
	return nil
}
