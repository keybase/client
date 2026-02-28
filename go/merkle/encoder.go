package merkle

import (
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha512"

	"github.com/pkg/errors"
)

type Encoder struct {
	encodingType EncodingType
}

func NewEncoder(encodingType EncodingType) *Encoder {
	return &Encoder{encodingType: encodingType}
}

func (e *Encoder) EncodingType() EncodingType {
	return e.encodingType
}

func (e *Encoder) BlindedPreimage(leaf Leaf, key Key, secret Secret) (BlindedPreimage, error) {
	switch e.encodingType {
	case EncodingTypeBlindedSHA512_256v1:
		h := hmac.New(sha512.New, secret.Secret)
		_, err := h.Write(key.Key)
		if err != nil {
			return BlindedPreimage{}, err
		}
		z := h.Sum(nil)
		return NewBlindedPreimage(leaf, z[:32])
	default:
		return BlindedPreimage{}, errors.Errorf("unknown encoding type %q", e.encodingType)
	}
}

func (e *Encoder) Hash(preimage BlindedPreimage) ([]byte, error) {
	b, err := preimage.LeafContainer.Serialize()
	if err != nil {
		return nil, err
	}
	switch e.encodingType {
	case EncodingTypeBlindedSHA512_256v1:
		h := hmac.New(sha512.New, preimage.BlindedEntropy)
		_, err := h.Write(b)
		if err != nil {
			return nil, err
		}
		z := h.Sum(nil)
		return z[:32], nil
	default:
		return nil, errors.Errorf("unknown encoding type %q", e.encodingType)
	}
}

func (e *Encoder) Encode(leaf Leaf, key Key, secret Secret) ([]byte, error) {
	preimage, err := e.BlindedPreimage(leaf, key, secret)
	if err != nil {
		return nil, err
	}
	return e.Hash(preimage)
}

func (e *Encoder) GenerateSecret() (Secret, error) {
	switch e.encodingType {
	case EncodingTypeBlindedSHA512_256v1:
		secret := make([]byte, 32)
		_, err := cryptorand.Read(secret)
		return NewSecret(secret), err
	default:
		return Secret{}, errors.Errorf("unknown encoding type %q", e.encodingType)
	}
}
