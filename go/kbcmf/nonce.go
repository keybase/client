package kbcmf

import (
	"crypto/sha512"
	"encoding/binary"
	"hash"
)

// Nonce is a NaCl-style nonce, with 24 bytes of data, some of which can be
// counter values, and some of which can be truly random values.
type Nonce [24]byte

type NonceType int

const (
	NonceTypeEncryptionKeyBox     NonceType = 0
	NonceTypeEncryptionPayloadBox NonceType = 1
)

func (n *Nonce) ForPayloadBox(i encryptionBlockNumber) *Nonce {
	n.mutate(uint64(NonceTypeEncryptionPayloadBox) + uint64(i))
	return n
}

func (n *Nonce) mutate(i uint64) {
	binary.BigEndian.PutUint64((*n)[16:], i)
}

func (n *Nonce) ForKeyBox() *Nonce {
	n.mutate(uint64(NonceTypeEncryptionKeyBox))
	return n
}

func writeStringToHash(h hash.Hash, s string) {
	h.Write([]byte(s))
	h.Write([]byte{0})
}

func NewNonceForEncryption(pk BoxPublicKey) *Nonce {
	raw := *pk.ToRawBoxKeyPointer()
	hasher := sha512.New()
	writeStringToHash(hasher, SaltPackFormatName)
	writeStringToHash(hasher, NoncePrefixEncryption)
	hasher.Write(raw[:])
	res := hasher.Sum(nil)
	var out Nonce
	copy(out[0:16], res)
	return &out
}
