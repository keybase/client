// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

// MessageType is an int used to describe what "type" of message it is.
type MessageType int

// PacketSeqno is a special int type used to describe which packet in the
// sequence we're dealing with.  The header is always at seqno=0. Other packets
// follow. Note that there is a distinction between PacketSeqno and EncryptionBlockNumber.
// In general, the former is one more than the latter.
type PacketSeqno uint64

// MessageTypeEncryption is a packet type to describe an encryption message
const MessageTypeEncryption MessageType = 0

// MessageTypeAttachedSignature is a packet type to describe an attached signature
const MessageTypeAttachedSignature MessageType = 1

// SaltPackCurrentVersion is currently the only supported packet version, 1.0
var SaltPackCurrentVersion = Version{Major: 1, Minor: 0}

// EncryptionBlockSize is by default 1MB and can't currently be tweaked.
const EncryptionBlockSize int = 1048576

// EncryptionArmorHeader is the header that marks the start of an encrypted
// armored KB message
const EncryptionArmorHeader = "BEGIN KEYBASE ENCRYPTED MESSAGE"

// EncryptionArmorFooter is the footer that marks the end of an encrypted
// armored KB message
const EncryptionArmorFooter = "END KEYBASE ENCRYPTED MESSAGE"

// SaltPackFormatName is the publicly advertised name of the format,
// used in the header of the message and also in Nonce creation.
const SaltPackFormatName = "SaltPack"

// NoncePrefixEncryption is the prefix used to create the nonce when
// using the nonce for encryption.
const NoncePrefixEncryption = "encryption nonce prefix"
