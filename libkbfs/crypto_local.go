package libkbfs

import "github.com/keybase/client/go/libkb"

const SigningKeySecretSize = libkb.NaclSigningKeySecretSize

type SigningKeySecret struct {
	secret [SigningKeySecretSize]byte
}

type SigningKey struct {
	kp libkb.NaclSigningKeyPair
}

// Make a new Nacl signing key pair from the given secret.
func makeSigningKey(secret SigningKeySecret) (SigningKey, error) {
	key, err := libkb.MakeNaclSigningKeyPairFromSecret(secret.secret)
	if err != nil {
		return SigningKey{}, err
	}

	return SigningKey{key}, nil
}

func (k SigningKey) GetVerifyingKey() VerifyingKey {
	return VerifyingKey{k.kp.Public.GetKid()}
}

type CryptoLocal struct {
	CryptoCommon
	signingKey SigningKey
}

var _ Crypto = (*CryptoLocal)(nil)

func NewCryptoLocal(codec Codec, signingKey SigningKey) *CryptoLocal {
	return &CryptoLocal{CryptoCommon{codec}, signingKey}
}

func (c *CryptoLocal) Sign(msg []byte) (sigInfo SignatureInfo, err error) {
	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    c.signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: c.signingKey.GetVerifyingKey(),
	}
	return
}
