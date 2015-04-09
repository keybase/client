package libkbfs

import (
	"crypto/sha256"

	libkb "github.com/keybase/client/go/libkb"
)

// CryptoNull is just a null passthrough
type CryptoNull struct {
}

func (c *CryptoNull) Sign(buf []byte) ([]byte, error) {
	return []byte{42}, nil
}

func (c *CryptoNull) Verify(sig []byte, buf []byte, key Key) error {
	return nil
}

func (c *CryptoNull) Box(privkey Key, pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoNull) Unbox(pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoNull) Encrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoNull) Decrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoNull) Hash(buf []byte) (libkb.NodeHash, error) {
	h := sha256.New()
	h.Write(buf)
	var tmp libkb.NodeHashShort
	copy([]byte(tmp[:]), h.Sum(nil))
	return tmp, nil
}

func (c *CryptoNull) VerifyHash(buf []byte, hash libkb.NodeHash) error {
	// TODO: for now just call Hash and throw an error if it doesn't match hash
	return nil
}

func (c *CryptoNull) SharedSecret(key1 Key, key2 Key) (Key, error) {
	return NullKey, nil
}

func (c *CryptoNull) HMAC(secret Key, buf []byte) (HMAC, error) {
	return []byte{42}, nil
}

func (c *CryptoNull) VerifyHMAC(secret Key, buf []byte, hmac HMAC) error {
	return nil
}

func (c *CryptoNull) XOR(key1 Key, key2 Key) (Key, error) {
	return NullKey, nil
}

func (c *CryptoNull) GenRandomSecretKey() Key {
	return NullKey
}

func (c *CryptoNull) GenCurveKeyPair() (pubkey Key, privkey Key) {
	return NullKey, NullKey
}
