package libkbfs

import (
	"crypto/sha256"
	"github.com/keybase/client/go/libkb"
)

type CryptoLocal struct {
	signingKey Key
}

func NewCryptoLocal(signingKey Key) *CryptoLocal {
	return &CryptoLocal{signingKey}
}

func (c *CryptoLocal) Sign(msg []byte) (sig []byte, kid KID, err error) {
	sig, err = c.signingKey.SignToBytes(msg)
	if err != nil {
		sig = nil
		return
	}
	return sig, KID(c.signingKey.GetKid()), nil
}

func (c *CryptoLocal) Verify(sig []byte, msg []byte, verifyingKey Key) (err error) {
	return verifyingKey.VerifyBytes(sig, msg)
}

func (c *CryptoLocal) Box(privkey Key, pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoLocal) Unbox(pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoLocal) Encrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoLocal) Decrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoLocal) Hash(buf []byte) (libkb.NodeHash, error) {
	h := sha256.New()
	h.Write(buf)
	var tmp libkb.NodeHashShort
	copy([]byte(tmp[:]), h.Sum(nil))
	return tmp, nil
}

func (c *CryptoLocal) VerifyHash(buf []byte, hash libkb.NodeHash) error {
	// TODO: for now just call Hash and throw an error if it doesn't match hash
	return nil
}

func (c *CryptoLocal) SharedSecret(key1 Key, key2 Key) (Key, error) {
	return nil, nil
}

func (c *CryptoLocal) HMAC(secret Key, buf []byte) (HMAC, error) {
	return []byte{42}, nil
}

func (c *CryptoLocal) VerifyHMAC(secret Key, buf []byte, hmac HMAC) error {
	return nil
}

func (c *CryptoLocal) XOR(key1 Key, key2 Key) (Key, error) {
	return nil, nil
}

func (c *CryptoLocal) GenRandomSecretKey() Key {
	return nil
}

func (c *CryptoLocal) GenCurveKeyPair() (pubkey Key, privkey Key) {
	return nil, nil
}
