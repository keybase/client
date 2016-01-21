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

// MessageTypeEncryption is a packet type to describe an
// encryption message.
const MessageTypeEncryption MessageType = 0

// MessageTypeAttachedSignature is a packet type to describe an
// attached signature.
const MessageTypeAttachedSignature MessageType = 1

// MessageTypeDetachedSignature is a packet type to describe a
// detached signature.
const MessageTypeDetachedSignature MessageType = 2

// SaltpackCurrentVersion is currently the only supported packet
// version, 1.0.
var SaltpackCurrentVersion = Version{Major: 1, Minor: 0}

// EncryptionBlockSize is by default 1MB and can't currently be tweaked.
const EncryptionBlockSize int = 1048576

const EncryptionArmorString = "ENCRYPTED MESSAGE"
const SignedArmorString = "SIGNED MESSAGE"
const DetachedSignatureArmorString = "DETACHED SIGNATURE"

// SaltpackFormatName is the publicly advertised name of the format,
// used in the header of the message and also in Nonce creation.
const SaltpackFormatName = "saltpack"

// NoncePrefixEncryption is the prefix used to create the nonce when
// using the nonce for encryption.
const NoncePrefixEncryption = "encryption nonce prefix"

// SignatureBlockSize is by default 1MB and can't currently be tweaked.
const SignatureBlockSize int = 1048576

// SignatureAttachedString is part of the data that is signed in
// each payload packet.
const SignatureAttachedString = "saltpack attached signature\x00"

// SignatureDetachedString is part of the data that is signed in
// a detached signature.
const SignatureDetachedString = "saltpack detached signature\x00"

// We truncate HMAC512 to the same link that NaCl's crypto_auth function does.
const CryptoAuthBytes = 32

const CryptoAuthKeyBytes = 32

type readState int

const (
	stateBody readState = iota
	stateEndOfStream
)

func (m MessageType) String() string {
	switch m {
	case MessageTypeEncryption:
		return "an encrypted message"
	case MessageTypeDetachedSignature:
		return "a detached signature"
	case MessageTypeAttachedSignature:
		return "an attached signature"
	default:
		return "an unknown message type"
	}
}
