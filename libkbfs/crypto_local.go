package libkbfs

import (
	"bytes"
	"fmt"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
)

// TODO: Some version of this should probably live in libkb.
type Signer interface {
	SignToBytes(msg []byte) (sig []byte, err error)
	GetVerifyingKey() VerifyingKey
}

type naclSigningKeyPair struct {
	libkb.NaclSigningKeyPair
}

func (kp *naclSigningKeyPair) GetVerifyingKey() VerifyingKey {
	return VerifyingKey{kp.GetKid()}
}

// A signing key secret is just SigningKeySecretLength random bytes.
//
// TODO: Ideally, ed25519 would expose how many random bytes it needs.
const SigningKeySecretLength = 32

type SigningKey struct {
	Secret [SigningKeySecretLength]byte
}

// Make a new Nacl signing key pair from the given secret.
func newNaclSigningKeyPair(secret [SigningKeySecretLength]byte) (*naclSigningKeyPair, error) {
	r := bytes.NewReader(secret[:])
	pub, priv, err := ed25519.GenerateKey(r)
	if err != nil {
		return nil, err
	}

	if r.Len() > 0 {
		return nil, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return &naclSigningKeyPair{
		libkb.NaclSigningKeyPair{
			Public:  *pub,
			Private: (*libkb.NaclSigningKeyPrivate)(priv),
		},
	}, nil
}

func newSigner(k SigningKey) (Signer, error) {
	return newNaclSigningKeyPair(k.Secret)
}

func (k SigningKey) GetVerifyingKey() (VerifyingKey, error) {
	kp, err := newSigner(k)
	if err != nil {
		return VerifyingKey{}, err
	}
	return kp.GetVerifyingKey(), nil
}

type CryptoLocal struct {
	CryptoCommon
	signingKey SigningKey
}

var _ Crypto = (*CryptoLocal)(nil)

func NewCryptoLocal(codec Codec, signingKey SigningKey) *CryptoLocal {
	return &CryptoLocal{CryptoCommon{codec}, signingKey}
}

func (c *CryptoLocal) Sign(msg []byte) (sig []byte, verifyingKey VerifyingKey, err error) {
	signer, err := newSigner(c.signingKey)
	sig, err = signer.SignToBytes(msg)
	if err != nil {
		sig = nil
		return
	}
	return sig, signer.GetVerifyingKey(), nil
}

func (c *CryptoLocal) Verify(sig []byte, msg []byte, verifyingKey VerifyingKey) (err error) {
	verifier, err := newVerifier(verifyingKey)
	if err != nil {
		return err
	}
	return verifier.VerifyBytes(sig, msg)
}
