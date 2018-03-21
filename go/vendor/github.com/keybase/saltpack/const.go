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

// MessageTypeSigncryption is a packet type to describe a
// signcrypted message.
const MessageTypeSigncryption MessageType = 3

// Version1 returns the Version for Saltpack V1.
func Version1() Version {
	return Version{Major: 1, Minor: 0}
}

// Version2 returns the Version for Saltpack V2.
func Version2() Version {
	return Version{Major: 2, Minor: 0}
}

// CurrentVersion returns the Version for the currently-used Saltpack
// version.
func CurrentVersion() Version {
	return Version2()
}

// KnownVersions returns all known Saltpack versions.
func KnownVersions() []Version {
	return []Version{Version1(), Version2()}
}

// encryptionBlockSize is by default 1MB and can't currently be tweaked.
const encryptionBlockSize int = 1048576

// EncryptionArmorString is included in armor headers for encrypted messages.
const EncryptionArmorString = "ENCRYPTED MESSAGE"

// SignedArmorString is included in armor headers for signed messages
const SignedArmorString = "SIGNED MESSAGE"

// DetachedSignatureArmorString is included in armor headers for detached signatures.
const DetachedSignatureArmorString = "DETACHED SIGNATURE"

// FormatName is the publicly advertised name of the format, used in
// the header of the message and also in Nonce creation.
const FormatName = "saltpack"

// signatureBlockSize is by default 1MB and can't currently be tweaked.
const signatureBlockSize int = 1048576

// signatureAttachedString is part of the data that is signed in
// each payload packet.
const signatureAttachedString = "saltpack attached signature\x00"

// signatureDetachedString is part of the data that is signed in
// a detached signature.
const signatureDetachedString = "saltpack detached signature\x00"

// signatureEncryptedString is part of the data that is signed in
// a signcryption signature.
const signatureEncryptedString = "saltpack encrypted signature\x00"

// signcryptionDerivedSymmetricKeyContext gets mixed in with the long term symmetric
// key and ephemeral key inputs, as an HMAC key
const signcryptionSymmetricKeyContext = "saltpack signcryption derived symmetric key"

// signcryptionBoxKeyIdentifierContext gets mixed in with the DH shared secret
// as an HMAC key, to make an opaque identifier
const signcryptionBoxKeyIdentifierContext = "saltpack signcryption box key identifier"

// We truncate HMAC512 to the same link that NaCl's crypto_auth function does.
const cryptoAuthBytes = 32

const cryptoAuthKeyBytes = 32

func (m MessageType) String() string {
	switch m {
	case MessageTypeEncryption:
		return "an encrypted message"
	case MessageTypeDetachedSignature:
		return "a detached signature"
	case MessageTypeAttachedSignature:
		return "an attached signature"
	case MessageTypeSigncryption:
		return "a signed and encrypted message"
	default:
		return "an unknown message type"
	}
}
