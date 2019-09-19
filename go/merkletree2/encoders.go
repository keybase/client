package merkletree2

import (
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha512"
	"fmt"

	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/go-codec/codec"
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
		return NewBlindedSHA512_256v1Encoder()
	case EncodingTypeSHA512_256ForTesting:
		return SHA512_256Encoder{}
	default:
		panic("Invalid EncodingType")
	}
}

// BlindedSHA512_256v1Encoder is not safe for concurrent use.
type BlindedSHA512_256v1Encoder struct {
	enc *codec.Encoder
	dec *codec.Decoder
}

var _ Encoder = BlindedSHA512_256v1Encoder{}

func NewBlindedSHA512_256v1Encoder() BlindedSHA512_256v1Encoder {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	mh.Canonical = true

	var mh2 codec.MsgpackHandle
	mh2.WriteExt = true
	mh2.Canonical = true

	return BlindedSHA512_256v1Encoder{enc: codec.NewEncoderBytes(nil, &mh), dec: codec.NewDecoderBytes(nil, &mh2)}
}

func (e BlindedSHA512_256v1Encoder) Encode(o interface{}) (out []byte, err error) {
	e.enc.ResetBytes(&out)
	return out, e.enc.Encode(o)
}

func (e BlindedSHA512_256v1Encoder) Decode(dest interface{}, src []byte) error {
	e.dec.ResetBytes(src)
	return e.dec.Decode(dest)
}

func (e BlindedSHA512_256v1Encoder) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := e.Encode(o)
	if err != nil {
		return nil, nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, nil, err
	}
	return enc, hasher.Sum(nil), nil
}

func (e BlindedSHA512_256v1Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := e.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (e BlindedSHA512_256v1Encoder) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (Hash, error) {
	// TODO this double encoding is unnecessary. Consider removing.
	enc, err := e.Encode(kevp)
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

func (e SHA512_256Encoder) Encode(o interface{}) ([]byte, error) {
	return msgpack.EncodeCanonical(o)
}

func (e SHA512_256Encoder) Decode(dest interface{}, src []byte) error {
	return msgpack.Decode(dest, src)
}

func (e SHA512_256Encoder) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := e.Encode(o)
	if err != nil {
		return nil, nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, nil, err
	}
	return enc, hasher.Sum(nil), nil
}

func (e SHA512_256Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := e.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (e SHA512_256Encoder) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (Hash, error) {
	// TODO this double encoding is unnecessary. Consider removing.
	enc, err := e.Encode(kevp)
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

func (e SHA512_256Encoder) GenerateMasterSecret(_ Seqno) (MasterSecret, error) {
	return nil, fmt.Errorf("This encoder does not support blinding")
}

func (e SHA512_256Encoder) ComputeKeySpecificSecret(_ MasterSecret, _ Key) KeySpecificSecret {
	return nil
}
