package merkletree2

import (
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha512"
	"fmt"

	"github.com/keybase/client/go/msgpack"
)

type EncodingType uint8

const (
	// For KeyValuePairs, the hash of the pair (k, v) is p(p(k, s), (k,v) ))
	// where p = HMAC-SHA512-256 and s is a secret unique per Merkle seqno. For
	// generic data structures, use SHA512-256 to hash the msgpack canonical
	// encoding.
	EncodingTypeBlindedSHA512_256v1 EncodingType = 1

	// Simple messagepack encoding and SHA256_512 hashing. Used for testing.
	EncodingTypeSHA512_256ForTesting EncodingType = 127
)

func (e EncodingType) GetEncoder() Encoder {
	switch e {
	case EncodingTypeBlindedSHA512_256v1:
		return BlindedSHA512_256v1Encoder{}
	case EncodingTypeSHA512_256ForTesting:
		return SHA512_256Encoder{}
	default:
		panic("Invalid EncodingType")
	}
}

type BlindedSHA512_256v1Encoder struct{}

var _ Encoder = BlindedSHA512_256v1Encoder{}

func (e BlindedSHA512_256v1Encoder) EncodeAndHashGeneric(o interface{}) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, err
	}
	return hasher.Sum(nil), nil
}

func (e BlindedSHA512_256v1Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(kvp)
	if err != nil {
		return nil, err
	}
	hasher := hmac.New(sha512.New512_256, kss)
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, err
	}
	return hasher.Sum(nil), nil
}

func (e BlindedSHA512_256v1Encoder) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	secret := make([]byte, 32)
	_, err := cryptorand.Read(secret)
	return MasterSecret(secret), err
}

func (e BlindedSHA512_256v1Encoder) ComputeKeySpecificSecret(ms MasterSecret, k Key) KeySpecificSecret {
	hasher := hmac.New(sha512.New512_256, ms)
	_, err := hasher.Write(k)
	if err != nil {
		panic("Error hashing")
	}
	return hasher.Sum(nil)
}

type SHA512_256Encoder struct{}

var _ Encoder = SHA512_256Encoder{}

func (e SHA512_256Encoder) EncodeAndHashGeneric(o interface{}) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, err
	}
	return hasher.Sum(nil), nil
}

func (e SHA512_256Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, _ KeySpecificSecret) (Hash, error) {
	return e.EncodeAndHashGeneric(kvp)
}

func (e SHA512_256Encoder) GenerateMasterSecret(_ Seqno) (MasterSecret, error) {
	return nil, fmt.Errorf("This encoder does not support blinding")
}

func (e SHA512_256Encoder) ComputeKeySpecificSecret(_ MasterSecret, _ Key) KeySpecificSecret {
	return nil
}
