// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

// PacketTag is an int used to describe what "tag" or "type" of packet it is.
type PacketTag int

// PacketVersion is an int used to capture the packet version. Right now, only
// Version=1 is supported
type PacketVersion int

// PacketSeqno is a special int type used to describe which packet in the
// sequence we're dealing with.  The header is always at seqno=0. Other packets
// follow. Note that there is a distinction between PacketSeqno and EncryptionBlockNumber.
// In general, the former is one more than the latter.
type PacketSeqno int

// PacketTagEncryptionHeader is a packet tag to describe the first packet
// in an encryption message.
const PacketTagEncryptionHeader PacketTag = 1

// PacketTagEncryptionBlock is a packet tag to describe the body of an encryption.
const PacketTagEncryptionBlock PacketTag = 2

// PacketTagSignature is a packet tag for describing a signature packet
const PacketTagSignature PacketTag = 3

// PacketVersion1 is currently the only supported packet version
const PacketVersion1 PacketVersion = 1

// EncryptionBlockSize is by default 1MB and can't currently be tweaked.
const EncryptionBlockSize int = 1048576

// EncryptionArmorHeader is the header that marks the start of an encrypted
// armored KB message
const EncryptionArmorHeader = "BEGIN KBr ENCRYPTED MESSAGE"

// EncryptionArmorFooter is the footer that marks the end of an encrypted
// armored KB message
const EncryptionArmorFooter = "END KBr ENCRYPTED MESSAGE"
