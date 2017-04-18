package saltpack

import (
	"crypto/rand"
	"encoding/binary"
)

const nonceBytes = 24

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be random-ish values.
type Nonce [nonceBytes]byte

func nonceForSenderKeySecretBox() *Nonce {
	var n Nonce
	copy(n[:], "saltpack_sender_key_sbox")
	return &n
}

func nonceForPayloadKeyBoxV1() *Nonce {
	var n Nonce
	copy(n[:], "saltpack_payload_key_box")
	return &n
}

func nonceForPayloadKeyBoxV2(recip uint64) *Nonce {
	var n Nonce
	copy(n[:], "saltpack_recipsbXXXXXXXX")
	return &n
}

func nonceForDerivedSharedKey() *Nonce {
	var n Nonce
	copy(n[:], "saltpack_derived_sboxkey")
	return &n
}

func nonceForMACKeyBox(headerHash []byte) *Nonce {
	if len(headerHash) != 64 {
		panic("Header hash shorter than expected.")
	}
	var n Nonce
	copy(n[:], headerHash[:nonceBytes])
	return &n
}

// Construct the nonce for the ith block of payload.
func nonceForChunkSecretBox(i encryptionBlockNumber) *Nonce {
	var n Nonce
	copy(n[0:16], "saltpack_ploadsb")
	binary.BigEndian.PutUint64(n[16:], uint64(i))
	return &n
}

// Construct the nonce for the ith block of payload. Differs in one letter from
// above. There's almost certainly no harm in using the same nonces here as
// above, since the encryption keys are ephemeral and the signatures already
// have their own context, but at the same time it's a good practice.
func nonceForChunkSigncryption(i encryptionBlockNumber) *Nonce {
	var n Nonce
	copy(n[0:16], "saltpack_ploadsc")
	binary.BigEndian.PutUint64(n[16:], uint64(i))
	return &n
}

// sigNonce is a nonce for signatures.
type sigNonce [16]byte

// newSigNonce creates a sigNonce with random bytes.
func newSigNonce() (sigNonce, error) {
	var n sigNonce
	if _, err := rand.Read(n[:]); err != nil {
		return sigNonce{}, err
	}
	return n, nil
}
