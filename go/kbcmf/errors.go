// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"errors"
	"fmt"
)

var (
	// ErrNoDecryptionKey is an error indicating no decryption key was found for the
	// incoming message. You'll get one of these if you respond to a Keyring.LookupSecretBoxKey
	// request with a (-1,nil) return value.
	ErrNoDecryptionKey = errors.New("no decryption key found for message")

	// ErrNoSenderKey indicates that on decryption we couldn't find a public key
	// for the sender.
	ErrNoSenderKey = errors.New("no sender key found for message")

	// ErrTrailingGarbage indicates that additional msgpack packets were found after the
	// end of the encryption stream.
	ErrTrailingGarbage = errors.New("trailing garbage found at end of message")

	// ErrPacketOverflow indicates that more than (2^64-2) packets were found in an encryption
	// stream.  This would indicate a very big message, and results in an error here.
	ErrPacketOverflow = errors.New("no more than 2^32 packets in a message are supported")

	// ErrBadFrame indiciates improper msgpack framing
	ErrBadFrame = errors.New("bad msgpack framing byte")

	// ErrInsufficientRandomness is generated when the encryption fails to collect
	// enough randomness to proceed.  We're using the standard crypto/rand source
	// of randomness, so this should never happen
	ErrInsufficientRandomness = errors.New("could not collect enough randomness")

	// ErrNoGroupMACKey is produced when we lack a group MAC key but the authenticated
	// ciphertexts indicated that one was required.
	ErrNoGroupMACKey = errors.New("no group MAC key, but we needed one")

	// Should never happen, so not exported.
	errPacketUnderflow = errors.New("no negative packet numbers allowed")

	// ErrBadArmorFrame shows up when the ASCII armor frame has non-ASCII
	ErrBadArmorFrame = errors.New("bad frame found; had non-ASCII")

	// ErrBadEphemeralKey is for when an ephemeral key fails to be properly
	// imported.
	ErrBadEphemeralKey = errors.New("bad ephermal key in header")

	// ErrBadReceivers shows up when you pass a bad receivers object -- either one
	// that was empty, or one that had an empty group.
	ErrBadReceivers = errors.New("bad receivers argument")
)

// ErrMACMismatch is generated when a MAC fails to check properly. It specifies
// which Packet sequence number the bad packet was in.
type ErrMACMismatch PacketSeqno

// ErrBadCiphertext is generated when decryption fails due to improper authentication. It specifies
// which Packet sequence number the bad packet was in.
type ErrBadCiphertext PacketSeqno

// ErrUnexpectedMAC is produced when an encryption includes an additional MAC but
// none was needed.
type ErrUnexpectedMAC PacketSeqno

// ErrRepeatedKey is produced during encryption if a key is repeated; keys must be
// unique.
type ErrRepeatedKey []byte

// ErrBadGroupID is produced if a GroupID is encountered that out-of-range
type ErrBadGroupID int

// ErrWrongPacketTag is produced if one packet tag was expected, but a packet
// of another tag was found.
type ErrWrongPacketTag struct {
	seqno    PacketSeqno
	wanted   PacketTag
	received PacketTag
}

// ErrBadVersion is returned if a packet of an unsupported version is found.
// Current, only Version1 is supported.
type ErrBadVersion struct {
	seqno    PacketSeqno
	received PacketVersion
}

// ErrBadNonce is produced when a header nonce is of the wrong size;
// it should be 20 bytes.
type ErrBadNonce struct {
	seqno   PacketSeqno
	byteLen int
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

func (e ErrWrongPacketTag) Error() string {
	return fmt.Sprintf("In packet %d: wanted tag=%d; got tag=%d", e.seqno, e.wanted, e.received)
}
func (e ErrBadVersion) Error() string {
	return fmt.Sprintf("In packet %d: unsupported version (%d)", e.seqno, e.received)
}
func (e ErrBadNonce) Error() string {
	return fmt.Sprintf("In packet %d: bad nonce; wrong lengh (%d)", e.seqno, e.byteLen)
}
func (e ErrBadCiphertext) Error() string {
	return fmt.Sprintf("In packet %d: bad ciphertext; failed Poly1305", e)
}
func (e ErrUnexpectedMAC) Error() string {
	return fmt.Sprintf("In packet %d: unexpected MAC (there was only 1 receiver)", e)
}
func (e ErrMACMismatch) Error() string {
	return fmt.Sprintf("In packet %d: MAC mismatch", e)
}
func (e ErrRepeatedKey) Error() string {
	return fmt.Sprintf("Repeated recipient key: %x", e)
}
func (e ErrBadGroupID) Error() string {
	return fmt.Sprintf("Bad group ID (no MAC keys available for it): %d", e)
}
