package libkbfs

import "github.com/keybase/client/go/libkb"

// SigningKeySecretSize is the size of a SigningKeySecret
const SigningKeySecretSize = libkb.NaclSigningKeySecretSize

// SigningKeySecret is a secret that can be used to construct a SigningKey
type SigningKeySecret struct {
	secret [SigningKeySecretSize]byte
}

// SigningKey is a key pair for signing.
type SigningKey struct {
	kp libkb.NaclSigningKeyPair
}

// makeSigningKey makes a new Nacl signing key pair from the given secret.
func makeSigningKey(secret SigningKeySecret) (SigningKey, error) {
	key, err := libkb.MakeNaclSigningKeyPairFromSecret(secret.secret)
	if err != nil {
		return SigningKey{}, err
	}

	return SigningKey{key}, nil
}

// GetVerifyingKey returns the public key half of this signing key.
func (k SigningKey) GetVerifyingKey() VerifyingKey {
	return VerifyingKey{k.kp.Public.GetKid()}
}

// CryptoLocal implements the Crypto interface using purely local
// operation (no RPC calls), by performing signatures using an
// in-memory signing key.
type CryptoLocal struct {
	CryptoCommon
	signingKey SigningKey
}

var _ Crypto = (*CryptoLocal)(nil)

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec Codec, signingKey SigningKey) *CryptoLocal {
	return &CryptoLocal{CryptoCommon{codec}, signingKey}
}

// Sign implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) Sign(msg []byte) (sigInfo SignatureInfo, err error) {
	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    c.signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: c.signingKey.GetVerifyingKey(),
	}
	return
}
