// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

// PacketType is an int used to describe what "type" of packet it is.
type PacketType int

// PacketSeqno is a special int type used to describe which packet in the
// sequence we're dealing with.  The header is always at seqno=0. Other packets
// follow. Note that there is a distinction between PacketSeqno and EncryptionBlockNumber.
// In general, the former is one more than the latter.
type PacketSeqno uint64

// PacketTypeEncryptionHeader is a packet type to describe an encryption message
const PacketTypeEncryption PacketType = 0

// PacketTypeAttachedSignature is a packet type to describe an attached signature
const PacketTypeAttachedSignature PacketType = 1

// PacketVersion1 is currently the only supported packet version
var SaltPackCurrentVersion = Version{Major: 1, Minor: 0}

// EncryptionBlockSize is by default 1MB and can't currently be tweaked.
const EncryptionBlockSize int = 1048576

// EncryptionArmorHeader is the header that marks the start of an encrypted
// armored KB message
const EncryptionArmorHeader = "BEGIN KEYBASE ENCRYPTED MESSAGE"

// EncryptionArmorFooter is the footer that marks the end of an encrypted
// armored KB message
const EncryptionArmorFooter = "END KEYBASE ENCRYPTED MESSAGE"

const SaltPackFormatName = "SaltPack"

const NoncePrefixEncryption = "encryption nonce prefix"
