package merkletree2

import (
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha512"

	"github.com/keybase/go-codec/codec"
)

type EncodingType uint8

const (
	// For KeyValuePairs, the hash of the pair (k, v) is p(p(k, s), v )) where p
	// = HMAC-SHA512-256 and s is a secret unique per Merkle seqno. Note that
	// users learn k, v and p(k,s) but not s itself, so the hash is a commitment
	// to the value only and not the key. However, the key is written and hashed
	// as part of the merkle tree leaf node, so keybase cannot equivocate that.
	// For generic data structures, this encoder uses SHA512-256 to hash the
	// msgpack canonical encoding.
	EncodingTypeBlindedSHA512_256v1 EncodingType = 1

	// Generic testing encoding.
	EncodingTypeForTesting EncodingType = 127
)

func (e EncodingType) GetEncoder() Encoder {
	switch e {
	case EncodingTypeBlindedSHA512_256v1:
		return NewBlindedSHA512_256v1Encoder()
	default:
		panic("Invalid EncodingType")
	}
}

type BlindedSHA512_256v1Encoder struct {
	mh codec.MsgpackHandle
}

var _ Encoder = &BlindedSHA512_256v1Encoder{}

func NewBlindedSHA512_256v1Encoder() *BlindedSHA512_256v1Encoder {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	mh.Canonical = true

	return &BlindedSHA512_256v1Encoder{mh: mh}
}

func (e *BlindedSHA512_256v1Encoder) Encode(o interface{}) (out []byte, err error) {
	return out, codec.NewEncoderBytes(&out, &e.mh).Encode(o)
}

func (e *BlindedSHA512_256v1Encoder) Decode(dest interface{}, src []byte) error {
	return codec.NewDecoderBytes(src, &e.mh).Decode(dest)
}

func (e *BlindedSHA512_256v1Encoder) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := e.Encode(o)
	if err != nil {
		return nil, nil, err
	}
	hasher := sha512.New512_256()
	// hasher.Write never errors.
	_, _ = hasher.Write(enc)
	return enc, hasher.Sum(nil), nil
}

func (e *BlindedSHA512_256v1Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := e.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (e *BlindedSHA512_256v1Encoder) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (Hash, error) {
	hasher := hmac.New(sha512.New512_256, kss)
	// hasher.Write never errors.
	_, _ = hasher.Write(kevp.Value)
	return hasher.Sum(nil), nil
}

func (e *BlindedSHA512_256v1Encoder) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	secret := make([]byte, 32)
	_, err := cryptorand.Read(secret)
	return MasterSecret(secret), err
}

func (e *BlindedSHA512_256v1Encoder) ComputeKeySpecificSecret(ms MasterSecret, k Key) KeySpecificSecret {
	hasher := hmac.New(sha512.New512_256, ms)
	// hasher.Write never errors.
	_, _ = hasher.Write(k)
	return hasher.Sum(nil)
}

func (e *BlindedSHA512_256v1Encoder) GetEncodingType() EncodingType {
	return EncodingTypeBlindedSHA512_256v1
}
