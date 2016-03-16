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

	// ErrFailedToReadHeaderBytes indicates that we failed to read the
	// doubly-encoded header bytes object from the input stream.
	ErrFailedToReadHeaderBytes = errors.New("failed to read header bytes")

	// ErrPacketOverflow indicates that more than (2^64-2) packets were found in an encryption
	// stream.  This would indicate a very big message, and results in an error here.
	ErrPacketOverflow = errors.New("no more than 2^32 packets in a message are supported")

	// ErrInsufficientRandomness is generated when the encryption fails to collect
	// enough randomness to proceed.  We're using the standard crypto/rand source
	// of randomness, so this should never happen
	ErrInsufficientRandomness = errors.New("could not collect enough randomness")

	// ErrBadEphemeralKey is for when an ephemeral key fails to be properly
	// imported.
	ErrBadEphemeralKey = errors.New("bad ephermal key in header")

	// ErrBadReceivers shows up when you pass a bad receivers vector
	ErrBadReceivers = errors.New("bad receivers argument")

	// ErrBadSenderKeySecretbox is returned if the sender secretbox fails to
	// open.
	ErrBadSenderKeySecretbox = errors.New("sender secretbox failed to open")

	// ErrBadSymmetricKey is returned if a key with the wrong number of bytes
	// is discovered in the encryption header.
	ErrBadSymmetricKey = errors.New("bad symmetric key; must be 32 bytes")

	// ErrBadBoxKey is returned if a key with the wrong number of bytes
	// is discovered in the encryption header.
	ErrBadBoxKey = errors.New("bad box key; must be 32 bytes")

	// ErrBadLookup is when the user-provided key lookup gives a bad value
	ErrBadLookup = errors.New("bad key lookup")

	// ErrBadSignature is returned when verification of a block fails.
	ErrBadSignature = errors.New("invalid signature")

	// ErrDecryptionFailed is returned when a decryption fails
	ErrDecryptionFailed = errors.New("decryption failed")
)

// ErrBadTag is generated when a payload hash doesn't match the hash
// authenticator. It specifies which Packet sequence number the bad packet was
// in.
type ErrBadTag packetSeqno

// ErrBadCiphertext is generated when decryption fails due to improper authentication. It specifies
// which Packet sequence number the bad packet was in.
type ErrBadCiphertext packetSeqno

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
	received Version
}

// ErrBadFrame shows up when the BEGIN or END frames have issues
type ErrBadFrame struct {
	msg string
}

func (e ErrBadFrame) Error() string {
	return fmt.Sprintf("Error in framing: %s", e.msg)
}

func makeErrBadFrame(format string, args ...interface{}) error {
	return ErrBadFrame{fmt.Sprintf(format, args...)}
}

func (e ErrWrongMessageType) Error() string {
	return fmt.Sprintf("Wrong saltpack message type: wanted %s, but got %s instead", e.wanted, e.received)
}
func (e ErrBadVersion) Error() string {
	return fmt.Sprintf("Unsupported version (%v)", e.received)
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
