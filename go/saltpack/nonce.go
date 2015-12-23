package saltpack

import (
	"crypto/rand"
	"crypto/sha512"
	"encoding/binary"
)

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be random-ish values.
type Nonce [24]byte

// NonceType is different for the different type of usages of the nonce.
type NonceType int

const (
	// NonceTypeEncryptionKeyBox is used for the header of an encrypted message
	NonceTypeEncryptionKeyBox NonceType = 0

	// NonceTypeEncryptionPayloadBox is used for the payload of an encrypted message
	NonceTypeEncryptionPayloadBox NonceType = 1
)

// ForPayloadBox formats this nonce for the ith block of payload.
func (n *Nonce) ForPayloadBox(i encryptionBlockNumber) *Nonce {
	n.mutate(uint64(NonceTypeEncryptionPayloadBox) + uint64(i))
	return n
}

func (n *Nonce) mutate(i uint64) {
	binary.BigEndian.PutUint64((*n)[16:], i)
}

// ForKeyBox formats the nonce for use the KeyBox in a message header.
func (n *Nonce) ForKeyBox() *Nonce {
	n.mutate(uint64(NonceTypeEncryptionKeyBox))
	return n
}

// NewNonceForEncryption creates a new nonce for the purposes of an encrypted
// message. It is a deterministic function of the ephemeral public key used
// for this encrypted message.
//
// **DO NOT** pass a long-live public key here, as you might lose the guarantee
// that each (nonce,key) pair must be unique over the lifetime of the universe.
//
func NewNonceForEncryption(ephemeralPublicKey BoxPublicKey) *Nonce {
	raw := *ephemeralPublicKey.ToRawBoxKeyPointer()
	hasher := sha512.New()
	writeNullTerminatedString(hasher, SaltPackFormatName)
	writeNullTerminatedString(hasher, NoncePrefixEncryption)
	hasher.Write(raw[:])
	res := hasher.Sum(nil)
	var out Nonce
	copy(out[0:16], res)
	return &out
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
