package libkbfs

import (
	"crypto/rand"
	"crypto/sha256"

	"github.com/keybase/client/go/libkb"
)

// CryptoCommon contains many of the function implementations need for
// the Crypto interface, which can be reused by other implementations.
type CryptoCommon struct {
	codec Codec
}

// MakeRandomBlockID implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeRandomBlockID() (BlockID, error) {
	var id BlockID
	_, err := rand.Read(id[:])
	if err != nil {
		return BlockID{}, err
	}
	return id, nil
}

// MakeRandomTLFKeys implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeRandomTLFKeys() (TLFPublicKey, TLFPrivateKey, TLFEphemeralPublicKey, TLFEphemeralPrivateKey, TLFCryptKey, error) {
	return TLFPublicKey{}, TLFPrivateKey{}, TLFEphemeralPublicKey{}, TLFEphemeralPrivateKey{}, TLFCryptKey{}, nil
}

// MakeRandomTLFCryptKeyServerHalf implements the Crypto interface for
// CryptoCommon.
func (c *CryptoCommon) MakeRandomTLFCryptKeyServerHalf() (TLFCryptKeyServerHalf, error) {
	return TLFCryptKeyServerHalf{}, nil
}

// MakeRandomBlockCryptKeyServerHalf implements the Crypto interface
// for CryptoCommon.
func (c *CryptoCommon) MakeRandomBlockCryptKeyServerHalf() (BlockCryptKeyServerHalf, error) {
	return BlockCryptKeyServerHalf{}, nil
}

// MaskTLFCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, key TLFCryptKey) (TLFCryptKeyClientHalf, error) {
	return TLFCryptKeyClientHalf{}, nil
}

// UnmaskTLFCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, clientHalf TLFCryptKeyClientHalf) (TLFCryptKey, error) {
	return TLFCryptKey{}, nil
}

// UnmaskBlockCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf, tlfCryptKey TLFCryptKey) (BlockCryptKey, error) {
	return BlockCryptKey{}, nil
}

// Verify implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) Verify(msg []byte, sigInfo SignatureInfo) (err error) {
	defer func() {
		libkb.G.Log.Debug("Verify result for %d-byte message with %s: %v", len(msg), sigInfo, err)
	}()

	if sigInfo.Version != SigED25519 {
		err = UnknownSigVer{sigInfo.Version}
		return
	}

	publicKey := sigInfo.VerifyingKey.KID.ToNaclSigningKeyPublic()
	if publicKey == nil {
		err = libkb.KeyCannotVerifyError{}
		return
	}

	var naclSignature libkb.NaclSignature
	if len(sigInfo.Signature) != len(naclSignature) {
		err = libkb.VerificationError{}
		return
	}
	copy(naclSignature[:], sigInfo.Signature)

	if !publicKey.Verify(msg, &naclSignature) {
		err = libkb.VerificationError{}
		return
	}

	return
}

// EncryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoCommon.
func (c *CryptoCommon) EncryptTLFCryptKeyClientHalf(privateKey TLFEphemeralPrivateKey, publicKey CryptPublicKey, clientHalf TLFCryptKeyClientHalf) ([]byte, error) {
	buf, err := c.codec.Encode(clientHalf)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoCommon.
func (c *CryptoCommon) DecryptTLFCryptKeyClientHalf(publicKey TLFEphemeralPublicKey, buf []byte) (TLFCryptKeyClientHalf, error) {
	var clientHalf TLFCryptKeyClientHalf
	if err := c.codec.Decode(buf, &clientHalf); err != nil {
		return TLFCryptKeyClientHalf{}, err
	}
	return clientHalf, nil
}

// EncryptPrivateMetadata implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) EncryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error) {
	return buf, nil
}

// DecryptPrivateMetadata implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) DecryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error) {
	return buf, nil
}

// EncryptBlock implements the Crypto interface for CryptoCommon.
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

// DecryptBlock implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) DecryptBlock(encryptedBlock []byte, key BlockCryptKey, block Block) (err error) {
	// TODO: When we actually do crypto here, make sure that
	// len(encodedBlock) <= len(encryptedBlock) holds.
	encodedBlock := encryptedBlock
	return c.codec.Decode(encodedBlock, &block)
}

// Hash implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) Hash(buf []byte) (libkb.NodeHash, error) {
	h := sha256.New()
	h.Write(buf)
	var tmp libkb.NodeHashShort
	copy([]byte(tmp[:]), h.Sum(nil))
	return tmp, nil
}

// VerifyHash implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) VerifyHash(buf []byte, hash libkb.NodeHash) error {
	// TODO: for now just call Hash and throw an error if it doesn't match hash
	return nil
}

// MAC implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MAC(publicMacKey MacPublicKey, buf []byte) (MAC, error) {
	return []byte{42}, nil
}

// VerifyMAC implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) VerifyMAC(publicMacKey MacPublicKey, buf []byte, mac MAC) error {
	return nil
}
