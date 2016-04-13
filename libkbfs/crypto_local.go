package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
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

// NewSigningKey returns a SigningKey using the given key pair.
func NewSigningKey(kp libkb.NaclSigningKeyPair) SigningKey {
	return SigningKey{kp}
}

// GetVerifyingKey returns the public key half of this signing key.
func (k SigningKey) GetVerifyingKey() VerifyingKey {
	return MakeVerifyingKey(k.kp.Public.GetKID())
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
	return MakeCryptPublicKey(k.kp.Public.GetKID())
}

// CryptoLocal implements the Crypto interface by using a local
// signing key and a local crypt private key.
type CryptoLocal struct {
	CryptoCommon

	lock            sync.RWMutex
	signingKey      SigningKey
	cryptPrivateKey CryptPrivateKey
}

var _ Crypto = (*CryptoLocal)(nil)

// NewCryptoLocal constructs a new CryptoLocal instance with the given
// signing key.
func NewCryptoLocal(config Config, signingKey SigningKey, cryptPrivateKey CryptPrivateKey) *CryptoLocal {
	return &CryptoLocal{
		CryptoCommon:    CryptoCommon{config.Codec(), config.MakeLogger("")},
		signingKey:      signingKey,
		cryptPrivateKey: cryptPrivateKey,
	}
}

// Sign implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) Sign(ctx context.Context, msg []byte) (
	sigInfo SignatureInfo, err error) {
	c.lock.RLock()
	defer c.lock.RUnlock()
	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    c.signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: c.signingKey.GetVerifyingKey(),
	}
	return
}

// SignToString implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) SignToString(ctx context.Context, msg []byte) (
	signature string, err error) {
	c.lock.RLock()
	defer c.lock.RUnlock()
	signature, _, err = c.signingKey.kp.SignToString(msg)
	return
}

func (c *CryptoLocal) prepareTLFCryptKeyClientHalf(encryptedClientHalf EncryptedTLFCryptKeyClientHalf,
	clientHalf TLFCryptKeyClientHalf) (
	nonce [24]byte, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	// This check isn't strictly needed, but parallels the
	// implementation in CryptoClient.
	if len(encryptedClientHalf.EncryptedData) != len(clientHalf.data)+box.Overhead {
		err = libkb.DecryptionError{}
		return
	}

	if len(encryptedClientHalf.Nonce) != len(nonce) {
		err = InvalidNonceError{encryptedClientHalf.Nonce}
		return
	}
	copy(nonce[:], encryptedClientHalf.Nonce)
	return
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf TLFCryptKeyClientHalf, err error) {
	c.lock.RLock()
	defer c.lock.RUnlock()

	nonce, err := c.prepareTLFCryptKeyClientHalf(encryptedClientHalf, clientHalf)
	if err != nil {
		return
	}

	decryptedData, ok := box.Open(nil, encryptedClientHalf.EncryptedData, &nonce, (*[32]byte)(&publicKey.data), (*[32]byte)(c.cryptPrivateKey.kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(clientHalf.data) {
		err = libkb.DecryptionError{}
		return
	}

	copy(clientHalf.data[:], decryptedData)
	return
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoLocal.
func (c *CryptoLocal) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, _ bool) (
	clientHalf TLFCryptKeyClientHalf, index int, err error) {
	c.lock.RLock()
	defer c.lock.RUnlock()

	if len(keys) == 0 {
		return clientHalf, index, NoKeysError{}
	}
	for i, k := range keys {
		nonce, err := c.prepareTLFCryptKeyClientHalf(k.ClientHalf, clientHalf)
		if err != nil {
			continue
		}
		decryptedData, ok := box.Open(nil, k.ClientHalf.EncryptedData, &nonce, (*[32]byte)(&k.EPubKey.data), (*[32]byte)(c.cryptPrivateKey.kp.Private))
		if ok {
			copy(clientHalf.data[:], decryptedData)
			return clientHalf, i, nil
		}
	}
	err = libkb.DecryptionError{}
	return
}

func (c *CryptoLocal) updateKeysForTesting(signingKey SigningKey,
	cryptPrivateKey CryptPrivateKey) {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.signingKey = signingKey
	c.cryptPrivateKey = cryptPrivateKey
}

// Shutdown implements the Crypto interface for CryptoLocal.
func (c *CryptoLocal) Shutdown() {}
