// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"errors"
	"fmt"
)

var (
	// ErrNoDecryptionKey is an error indicating no decryption key was found for the
	// incoming message. You'll get one of these if you respond to a Keyring.LookupSecretBoxKey
	// request with a (-1,nil) return value, and no hidden keys are found.
	ErrNoDecryptionKey = errors.New("no decryption key found for message")

	// ErrNoSenderKey indicates that on decryption/verification we couldn't find a public key
	// for the sender.
	ErrNoSenderKey = errors.New("no sender key found for message")

	// ErrTrailingGarbage indicates that additional msgpack packets were found after the
	// end of the encryption stream.
	ErrTrailingGarbage = errors.New("trailing garbage found at end of message")

	// ErrPacketOverflow indicates that more than (2^64-2) packets were found in an encryption
	// stream.  This would indicate a very big message, and results in an error here.
	ErrPacketOverflow = errors.New("no more than 2^32 packets in a message are supported")

	// ErrInsufficientRandomness is generated when the encryption fails to collect
	// enough randomness to proceed.  We're using the standard crypto/rand source
	// of randomness, so this should never happen
	ErrInsufficientRandomness = errors.New("could not collect enough randomness")

	// ErrBadArmorFrame shows up when the ASCII armor frame has non-ASCII
	ErrBadArmorFrame = errors.New("bad frame found; had non-ASCII")

	// ErrBadEphemeralKey is for when an ephemeral key fails to be properly
	// imported.
	ErrBadEphemeralKey = errors.New("bad ephermal key in header")

	// ErrBadReceivers shows up when you pass a bad receivers vector
	ErrBadReceivers = errors.New("bad receivers argument")

	// ErrBadSenderKey is returned if a key with the wrong number of bytes
	// is discovered in the encryption header.
	ErrBadSenderKey = errors.New("bad sender key; must be 32 bytes")

	// ErrBadLookup is when the user-provided key lookup gives a bad value
	ErrBadLookup = errors.New("bad key lookup")

	// ErrBadSignature is returned when verification of a block fails.
	ErrBadSignature = errors.New("invalid signature")

	// ErrNoDetachedSignature is returned when there is no signature in the header.
	ErrNoDetachedSignature = errors.New("no detached signature")

	// ErrDetachedSignaturePresent is returned when there is a signature in the header and
	// there shouldn't be.
	ErrDetachedSignaturePresent = errors.New("detached signature present")
)

// ErrBadTag is generated when a Tag fails to Unbox properly. It specifies
// which Packet sequence number the bad packet was in.
type ErrBadTag PacketSeqno

// ErrBadCiphertext is generated when decryption fails due to improper authentication. It specifies
// which Packet sequence number the bad packet was in.
type ErrBadCiphertext PacketSeqno

// ErrRepeatedKey is produced during encryption if a key is repeated; keys must be
// unique.
type ErrRepeatedKey []byte

// ErrWrongMessageType is produced if one packet tag was expected, but a packet
// of another tag was found.
type ErrWrongMessageType struct {
	wanted   MessageType
	received MessageType
}

// ErrBadVersion is returned if a packet of an unsupported version is found.
// Current, only Version1 is supported.
type ErrBadVersion struct {
	seqno    PacketSeqno
	received Version
}

// ErrBadArmorHeader shows up when we get the wrong value for our header
type ErrBadArmorHeader struct {
	wanted   string
	received string
}

// ErrBadArmorFooter shows up when we get the wrong value for our header
type ErrBadArmorFooter struct {
	wanted   string
	received string
}

func (e ErrBadArmorFooter) Error() string {
	return fmt.Sprintf("Bad encryption armor footer; wanted '%s' but got '%s'",
		e.wanted, e.received)
}

func (e ErrBadArmorHeader) Error() string {
	return fmt.Sprintf("Bad encryption armor header; wanted '%s' but got '%s'",
		e.wanted, e.received)
}

func (e ErrWrongMessageType) Error() string {
	return fmt.Sprintf("Wanted type=%d; got type=%d", e.wanted, e.received)
}
func (e ErrBadVersion) Error() string {
	return fmt.Sprintf("In packet %d: unsupported version (%v)", e.seqno, e.received)
}
func (e ErrBadCiphertext) Error() string {
	return fmt.Sprintf("In packet %d: bad ciphertext; failed Poly1305", e)
}
func (e ErrBadTag) Error() string {
	return fmt.Sprintf("In packet %d: bad Poly1305 tag; data was corrupted in transit", e)
}
func (e ErrRepeatedKey) Error() string {
	return fmt.Sprintf("Repeated recipient key: %x", []byte(e))
}

// ErrInvalidParameter signifies that a function was called with
// an invalid parameter.
type ErrInvalidParameter struct {
	message string
}

func (e ErrInvalidParameter) Error() string {
	return fmt.Sprintf("Invalid parameter: %s", e.message)
}
