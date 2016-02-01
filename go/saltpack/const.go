// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

// MessageType is an int used to describe what "type" of message it is.
type MessageType int

// packetSeqno is a special int type used to describe which packet in the
// sequence we're dealing with.  The header is always at seqno=0. Other packets
// follow. Note that there is a distinction between packetSeqno and encryptionBlockNumber.
// In general, the former is one more than the latter.
type packetSeqno uint64

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

// encryptionBlockSize is by default 1MB and can't currently be tweaked.
const encryptionBlockSize int = 1048576

// EncryptionArmorString is included in armor headers for encrypted messages.
const EncryptionArmorString = "ENCRYPTED MESSAGE"

// SignedArmorString is included in armor headers for signed messages
const SignedArmorString = "SIGNED MESSAGE"

// DetachedSignatureArmorString is included in armor headers for detached signatures.
const DetachedSignatureArmorString = "DETACHED SIGNATURE"

// SaltpackFormatName is the publicly advertised name of the format,
// used in the header of the message and also in Nonce creation.
const SaltpackFormatName = "saltpack"

// signatureBlockSize is by default 1MB and can't currently be tweaked.
const signatureBlockSize int = 1048576

// signatureAttachedString is part of the data that is signed in
// each payload packet.
const signatureAttachedString = "saltpack attached signature\x00"

// signatureDetachedString is part of the data that is signed in
// a detached signature.
const signatureDetachedString = "saltpack detached signature\x00"

// We truncate HMAC512 to the same link that NaCl's crypto_auth function does.
const cryptoAuthBytes = 32

const cryptoAuthKeyBytes = 32

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
