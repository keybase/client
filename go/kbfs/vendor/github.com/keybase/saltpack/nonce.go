package saltpack

import (
	"encoding/binary"
)

const nonceBytes = 24

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be random-ish values.
type Nonce [nonceBytes]byte

func nonceForSenderKeySecretBox() Nonce {
	return stringToByte24("saltpack_sender_key_sbox")
}

func nonceForPayloadKeyBoxV2(recip uint64) Nonce {
	var n Nonce
	off := len(n) - 8
	copyEqualSizeStr(n[:off], "saltpack_recipsb")
	binary.BigEndian.PutUint64(n[off:], uint64(recip))
	return n
}

func nonceForPayloadKeyBox(version Version, recip uint64) Nonce {
	// Switch on the major version since this is called during
	// both writing and reading, and in the latter we may
	// encounter headers written by unknown minor versions.
	switch version.Major {
	case 1:
		return stringToByte24("saltpack_payload_key_box")
	case 2:
		return nonceForPayloadKeyBoxV2(recip)
	default:
		// Let caller be responsible for filtering out unknown
		// versions.
		panic(ErrBadVersion{version})
	}
}

func nonceForDerivedSharedKey() Nonce {
	return stringToByte24("saltpack_derived_sboxkey")
}

func nonceForMACKeyBoxV1(headerHash headerHash) Nonce {
	return sliceToByte24(headerHash[:nonceBytes])
}

func nonceForMACKeyBoxV2(headerHash headerHash, ephemeral bool, recip uint64) Nonce {
	var n Nonce
	off := len(n) - 8
	copyEqualSize(n[:off], headerHash[:off])
	// Set LSB of last byte based on ephemeral.
	n[off-1] &^= 1
	if ephemeral {
		n[off-1] |= 1
	}
	binary.BigEndian.PutUint64(n[off:], uint64(recip))
	return n
}

// Construct the nonce for the ith block of encryption payload.
func nonceForChunkSecretBox(i encryptionBlockNumber) Nonce {
	var n Nonce
	copyEqualSizeStr(n[0:16], "saltpack_ploadsb")
	binary.BigEndian.PutUint64(n[16:], uint64(i))
	return n
}

// Construct the nonce for the ith block of signcryption
// payload.
func nonceForChunkSigncryption(headerHash headerHash, isFinal bool, i encryptionBlockNumber) Nonce {
	var n Nonce
	off := len(n) - 8
	copyEqualSize(n[:off], headerHash[:off])
	// Set LSB of last byte based on isFinal.
	n[off-1] &^= 1
	if isFinal {
		n[off-1] |= 1
	}
	binary.BigEndian.PutUint64(n[off:], uint64(i))
	return n
}

// sigNonce is a nonce for signatures.
type sigNonce [16]byte

// newSigNonce creates a sigNonce with random bytes.
func newSigNonce() (sigNonce, error) {
	var n sigNonce
	if err := csprngRead(n[:]); err != nil {
		return sigNonce{}, err
	}
	return n, nil
}
