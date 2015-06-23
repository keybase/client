package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
)

// SigningKeySecretSize is the size of a SigningKeySecret.
const SigningKeySecretSize = libkb.NaclSigningKeySecretSize

// SigningKeySecret is a secret that can be used to construct a SigningKey.
type SigningKeySecret struct {
	secret [SigningKeySecretSize]byte
}

// SigningKey is a key pair for signing.
type SigningKey struct {
	kp libkb.NaclSigningKeyPair
}

// makeSigningKey makes a new Nacl signing key from the given secret.
func makeSigningKey(secret SigningKeySecret) (SigningKey, error) {
	kp, err := libkb.MakeNaclSigningKeyPairFromSecret(secret.secret)
	if err != nil {
		return SigningKey{}, err
	}

	return SigningKey{kp}, nil
}

// getVerifyingKey returns the public key half of this signing key.
func (k SigningKey) getVerifyingKey() VerifyingKey {
	return VerifyingKey{k.kp.Public.GetKid()}
}

// CryptPrivateKeySecretSize is the size of a CryptPrivateKeySecret.
const CryptPrivateKeySecretSize = libkb.NaclDHKeySecretSize

// CryptPrivateKeySecret is a secret that can be used to construct a
// CryptPrivateKey.
type CryptPrivateKeySecret struct {
	secret [CryptPrivateKeySecretSize]byte
}

// CryptPrivateKey is a private key for encryption/decryption.
type CryptPrivateKey struct {
	kp libkb.NaclDHKeyPair
}

// makeCryptPrivateKey makes a new Nacl encryption/decryption key from
// the given secret.
func makeCryptPrivateKey(secret CryptPrivateKeySecret) (CryptPrivateKey, error) {
	kp, err := libkb.MakeNaclDHKeyPairFromSecret(secret.secret)
	if err != nil {
		return CryptPrivateKey{}, err
	}

	return CryptPrivateKey{kp}, nil
}

// GetPublicKey returns the public key corresponding to this private
// key.
func (k CryptPrivateKey) getPublicKey() CryptPublicKey {
	return CryptPublicKey{k.kp.Public.GetKid()}
}

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon
	signingKey      SigningKey
	cryptPrivateKey CryptPrivateKey
}

var _ Crypto = (*CryptoLocal)(nil)

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(codec Codec, signingKey SigningKey, cryptPrivateKey CryptPrivateKey) *CryptoLocal {
	return &CryptoLocal{CryptoCommon{codec}, signingKey, cryptPrivateKey}
}

// Sign implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) Sign(msg []byte) (sigInfo SignatureInfo, err error) {
	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    c.signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: c.signingKey.getVerifyingKey(),
	}
	return
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTLFCryptKeyClientHalf(publicKey TLFEphemeralPublicKey, encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (clientHalf TLFCryptKeyClientHalf, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	// This check isn't strictly needed, but parallels the
	// implementation in CryptoClient.
	if len(encryptedClientHalf.EncryptedData) != len(clientHalf.ClientHalf)+box.Overhead {
		err = libkb.DecryptionError{}
		return
	}

	var nonce [24]byte
	if len(encryptedClientHalf.Nonce) != len(nonce) {
		err = InvalidNonceError{encryptedClientHalf.Nonce}
		return
	}
	copy(nonce[:], encryptedClientHalf.Nonce)

	decryptedData, ok := box.Open(nil, encryptedClientHalf.EncryptedData, &nonce, (*[32]byte)(&publicKey.PublicKey), (*[32]byte)(c.cryptPrivateKey.kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(clientHalf.ClientHalf) {
		err = libkb.DecryptionError{}
		return
	}

	copy(clientHalf.ClientHalf[:], decryptedData)
	return
}
