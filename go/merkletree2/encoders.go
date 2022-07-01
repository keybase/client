package merkletree2

import (
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha512"
	"hash"

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

// This function returns an encoder which is potentially unsafe for concurrent
// use.
func (e EncodingType) GetUnsafeEncoder() Encoder {
	switch e {
	case EncodingTypeBlindedSHA512_256v1:
		return NewUnsafeBlindedSHA512_256v1Encoder()
	default:
		panic("Invalid EncodingType")
	}
}

// UnsafeBlindedSHA512_256v1Encoder is analogous to BlindedSHA512_256v1Encoder,
// but sometimes faster and not safe for concurrent use.
type UnsafeBlindedSHA512_256v1Encoder struct {
	BlindedSHA512_256v1Inner
	enc    *codec.Encoder
	dec    *codec.Decoder
	sha    hash.Hash
	encBuf []byte
}

var _ Encoder = (*UnsafeBlindedSHA512_256v1Encoder)(nil)

func NewUnsafeBlindedSHA512_256v1Encoder() *UnsafeBlindedSHA512_256v1Encoder {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	mh.Canonical = true

	return &UnsafeBlindedSHA512_256v1Encoder{enc: codec.NewEncoderBytes(nil, &mh), dec: codec.NewDecoderBytes(nil, &mh), sha: sha512.New512_256()}
}

func (e *UnsafeBlindedSHA512_256v1Encoder) EncodeTo(o interface{}, out *[]byte) (err error) {
	e.enc.ResetBytes(out)
	return e.enc.Encode(o)
}

func (e *UnsafeBlindedSHA512_256v1Encoder) Encode(o interface{}) (out []byte, err error) {
	return out, e.EncodeTo(o, &out)
}

func (e *UnsafeBlindedSHA512_256v1Encoder) Decode(dest interface{}, src []byte) error {
	e.dec.ResetBytes(src)
	return e.dec.Decode(dest)
}

func (e *UnsafeBlindedSHA512_256v1Encoder) HashGeneric(o interface{}, ret *Hash) error {
	err := e.EncodeTo(o, &e.encBuf)
	if err != nil {
		return err
	}
	e.sha.Reset()
	_, _ = e.sha.Write(e.encBuf)
	*ret = e.sha.Sum((*ret)[:0])
	return nil
}

func (e *UnsafeBlindedSHA512_256v1Encoder) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := e.Encode(o)
	if err != nil {
		return nil, nil, err
	}
	e.sha.Reset()
	// sha.Write never errors.
	_, _ = e.sha.Write(enc)
	return enc, e.sha.Sum(nil), nil
}

func (e *UnsafeBlindedSHA512_256v1Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	err := e.EncodeTo(kvp.Value, &e.encBuf)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: e.encBuf}, kss)
}

type BlindedSHA512_256v1Encoder struct {
	BlindedSHA512_256v1Inner
	mh codec.MsgpackHandle
}

var _ Encoder = &BlindedSHA512_256v1Encoder{}

func NewBlindedSHA512_256v1Encoder() *BlindedSHA512_256v1Encoder {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	mh.Canonical = true

	return &BlindedSHA512_256v1Encoder{mh: mh}
}

func (e *BlindedSHA512_256v1Encoder) EncodeTo(o interface{}, out *[]byte) (err error) {
	return codec.NewEncoderBytes(out, &e.mh).Encode(o)
}

func (e *BlindedSHA512_256v1Encoder) Encode(o interface{}) (out []byte, err error) {
	return out, e.EncodeTo(o, &out)
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

func (e *BlindedSHA512_256v1Encoder) HashGeneric(o interface{}, ret *Hash) error {
	enc, err := e.Encode(o)
	if err != nil {
		return err
	}
	hasher := sha512.New512_256()
	// hasher.Write never errors.
	_, _ = hasher.Write(enc)
	*ret = hasher.Sum((*ret)[:0])
	return nil
}

func (e *BlindedSHA512_256v1Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := e.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

type BlindedSHA512_256v1Inner struct{}

func (e BlindedSHA512_256v1Inner) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (h Hash, err error) {
	return h, e.HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp, kss, &h)
}

func (e BlindedSHA512_256v1Inner) HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp KeyEncodedValuePair, kss KeySpecificSecret, ret *Hash) error {
	hasher := hmac.New(sha512.New512_256, kss)
	// hasher.Write never errors.
	_, _ = hasher.Write(kevp.Value)
	*ret = hasher.Sum((*ret)[:0])
	return nil
}

func (e BlindedSHA512_256v1Inner) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	secret := make([]byte, 32)
	_, err := cryptorand.Read(secret)
	return MasterSecret(secret), err
}

func (e BlindedSHA512_256v1Inner) ComputeKeySpecificSecret(ms MasterSecret, k Key) (kss KeySpecificSecret) {
	e.ComputeKeySpecificSecretTo(ms, k, &kss)
	return kss
}

func (e BlindedSHA512_256v1Inner) ComputeKeySpecificSecretTo(ms MasterSecret, k Key, ret *KeySpecificSecret) {
	hasher := hmac.New(sha512.New512_256, ms)
	// hasher.Write never errors.
	_, _ = hasher.Write(k)
	*ret = hasher.Sum((*ret)[:0])
}

func (e BlindedSHA512_256v1Inner) GetEncodingType() EncodingType {
	return EncodingTypeBlindedSHA512_256v1
}
