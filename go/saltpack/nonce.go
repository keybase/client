package saltpack

import (
	"crypto/rand"
	"encoding/binary"
)

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be random-ish values.
type Nonce [24]byte

func nonceForSenderKeySecretBox() *Nonce {
	var n Nonce
	copy(n[:], "saltpack_sender_key\x00\x00\x00\x00\x00")
	return &n
}

func nonceForPayloadKeyBox() *Nonce {
	var n Nonce
	copy(n[:], "saltpack_payload_key\x00\x00\x00\x00")
	return &n
}

func nonceForMACKeyBox(headerHash []byte) *Nonce {
	var n Nonce
	copy(n[:], headerHash[:24])
	return &n
}

// Construct the nonce for the ith block of payload.
func nonceForChunkSecretBox(i encryptionBlockNumber) *Nonce {
	var n Nonce
	copy(n[0:16], "saltpack_payload")
	binary.BigEndian.PutUint64(n[16:], uint64(i))
	return &n
}

// SigNonce is a nonce for signatures.
type SigNonce [16]byte

// NewSigNonce creates a SigNonce with random bytes.
func NewSigNonce() (SigNonce, error) {
	var n SigNonce
	if _, err := rand.Read(n[:]); err != nil {
		return SigNonce{}, err
	}
	return n, nil
}
