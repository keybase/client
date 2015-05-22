package libkbfs

import (
	"crypto/rand"
	"crypto/sha256"

	"github.com/keybase/client/go/libkb"
)

// TODO: This should probably live in libkb.
type Verifier interface {
	VerifyBytes(sig, msg []byte) (err error)
}

func newVerifier(k VerifyingKey) (Verifier, error) {
	return libkb.ImportKeypairFromKID(k.KID, nil)
}

type CryptoCommon struct {
	codec Codec
}

func (c *CryptoCommon) MakeRandomBlockId() (BlockId, error) {
	var id BlockId
	_, err := rand.Read(id[:])
	if err != nil {
		return BlockId{}, err
	}
	return id, nil
}

func (c *CryptoCommon) MakeRandomTLFKeys() (TLFPublicKey, TLFPrivateKey, TLFEphemeralPublicKey, TLFEphemeralPrivateKey, TLFCryptKey, error) {
	return TLFPublicKey{}, TLFPrivateKey{}, TLFEphemeralPublicKey{}, TLFEphemeralPrivateKey{}, TLFCryptKey{}, nil
}

func (c *CryptoCommon) MakeRandomTLFCryptKeyServerHalf() (TLFCryptKeyServerHalf, error) {
	return TLFCryptKeyServerHalf{}, nil
}

func (c *CryptoCommon) MakeRandomBlockCryptKeyServerHalf() (BlockCryptKeyServerHalf, error) {
	return BlockCryptKeyServerHalf{}, nil
}

func (c *CryptoCommon) MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, key TLFCryptKey) (TLFCryptKeyClientHalf, error) {
	return TLFCryptKeyClientHalf{}, nil
}

func (c *CryptoCommon) UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, clientHalf TLFCryptKeyClientHalf) (TLFCryptKey, error) {
	return TLFCryptKey{}, nil
}

func (c *CryptoCommon) UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf, tlfCryptKey TLFCryptKey) (BlockCryptKey, error) {
	return BlockCryptKey{}, nil
}

func (c *CryptoCommon) EncryptTLFCryptKeyClientHalf(privateKey TLFEphemeralPrivateKey, publicKey CryptPublicKey, clientHalf TLFCryptKeyClientHalf) ([]byte, error) {
	buf, err := c.codec.Encode(clientHalf)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

func (c *CryptoCommon) DecryptTLFCryptKeyClientHalf(publicKey TLFEphemeralPublicKey, buf []byte) (TLFCryptKeyClientHalf, error) {
	var clientHalf TLFCryptKeyClientHalf
	if err := c.codec.Decode(buf, &clientHalf); err != nil {
		return TLFCryptKeyClientHalf{}, err
	}
	return clientHalf, nil
}

func (c *CryptoCommon) EncryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error) {
	return buf, nil
}

func (c *CryptoCommon) DecryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error) {
	return buf, nil
}

func (c *CryptoCommon) EncryptBlock(block Block, key BlockCryptKey) (plainSize int, encryptedBlock []byte, err error) {
	// TODO: add padding
	encodedBlock, err := c.codec.Encode(block)
	if err != nil {
		return
	}
	// TODO: When we actually do crypto here, make sure that
	// plainSize <= len(encryptedBlock) still holds.
	plainSize = len(encodedBlock)
	encryptedBlock = encodedBlock
	return
}

func (c *CryptoCommon) DecryptBlock(encryptedBlock []byte, key BlockCryptKey, block Block) (err error) {
	// TODO: When we actually do crypto here, make sure that
	// len(encodedBlock) <= len(encryptedBlock) holds.
	encodedBlock := encryptedBlock
	return c.codec.Decode(encodedBlock, &block)
}

func (c *CryptoCommon) Hash(buf []byte) (libkb.NodeHash, error) {
	h := sha256.New()
	h.Write(buf)
	var tmp libkb.NodeHashShort
	copy([]byte(tmp[:]), h.Sum(nil))
	return tmp, nil
}

func (c *CryptoCommon) VerifyHash(buf []byte, hash libkb.NodeHash) error {
	// TODO: for now just call Hash and throw an error if it doesn't match hash
	return nil
}

func (c *CryptoCommon) MAC(publicMacKey MacPublicKey, buf []byte) (MAC, error) {
	return []byte{42}, nil
}

func (c *CryptoCommon) VerifyMAC(publicMacKey MacPublicKey, buf []byte, mac MAC) error {
	return nil
}
