package libkbfs

import (
	"crypto/rand"
	"crypto/sha256"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
)

// Belt-and-suspenders wrapper around crypto.rand.Read().
func cryptoRandRead(buf []byte) error {
	n, err := rand.Read(buf)
	if err != nil {
		return err
	}
	// This is truly unexpected, as rand.Read() is supposed to
	// return an error on a short read already!
	if n != len(buf) {
		return UnexpectedShortCryptoRandRead{}
	}
	return nil
}

// CryptoCommon contains many of the function implementations need for
// the Crypto interface, which can be reused by other implementations.
type CryptoCommon struct {
	codec Codec
}

// MakeRandomDirID implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeRandomDirID(isPublic bool) (DirID, error) {
	var id DirID
	err := cryptoRandRead(id[:])
	if err != nil {
		return DirID{}, err
	}
	if isPublic {
		id[len(id)-1] = PubDirIDSuffix
	} else {
		id[len(id)-1] = DirIDSuffix
	}
	return id, nil
}

// MakeTemporaryBlockID implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeTemporaryBlockID() (BlockID, error) {
	var id BlockID
	err := cryptoRandRead(id[:])
	if err != nil {
		return BlockID{}, err
	}
	return id, nil
}

// MakeBlockRefNonce implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeBlockRefNonce() (nonce BlockRefNonce, err error) {
	err = cryptoRandRead(nonce[:])
	return
}

// MakeRandomTLFKeys implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MakeRandomTLFKeys() (
	tlfPublicKey TLFPublicKey,
	tlfPrivateKey TLFPrivateKey,
	tlfEphemeralPublicKey TLFEphemeralPublicKey,
	tlfEphemeralPrivateKey TLFEphemeralPrivateKey,
	tlfCryptKey TLFCryptKey,
	err error) {
	defer func() {
		if err != nil {
			tlfPublicKey = TLFPublicKey{}
			tlfPrivateKey = TLFPrivateKey{}
			tlfEphemeralPublicKey = TLFEphemeralPublicKey{}
			tlfEphemeralPrivateKey = TLFEphemeralPrivateKey{}
			tlfCryptKey = TLFCryptKey{}
		}
	}()

	publicKey, privateKey, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return
	}

	tlfPublicKey = TLFPublicKey{*publicKey}
	tlfPrivateKey = TLFPrivateKey{*privateKey}

	keyPair, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return
	}

	tlfEphemeralPublicKey = TLFEphemeralPublicKey{keyPair.Public}
	tlfEphemeralPrivateKey = TLFEphemeralPrivateKey{*keyPair.Private}

	err = cryptoRandRead(tlfCryptKey.Key[:])
	if err != nil {
		return
	}

	return
}

// MakeRandomTLFCryptKeyServerHalf implements the Crypto interface for
// CryptoCommon.
func (c *CryptoCommon) MakeRandomTLFCryptKeyServerHalf() (serverHalf TLFCryptKeyServerHalf, err error) {
	err = cryptoRandRead(serverHalf.ServerHalf[:])
	if err != nil {
		serverHalf = TLFCryptKeyServerHalf{}
		return
	}
	return
}

// MakeRandomBlockCryptKeyServerHalf implements the Crypto interface
// for CryptoCommon.
func (c *CryptoCommon) MakeRandomBlockCryptKeyServerHalf() (serverHalf BlockCryptKeyServerHalf, err error) {
	err = cryptoRandRead(serverHalf.ServerHalf[:])
	if err != nil {
		serverHalf = BlockCryptKeyServerHalf{}
		return
	}
	return
}

func xorKeys(x, y [32]byte) [32]byte {
	var res [32]byte
	for i := 0; i < 32; i++ {
		res[i] = x[i] ^ y[i]
	}
	return res
}

// MaskTLFCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, key TLFCryptKey) (clientHalf TLFCryptKeyClientHalf, err error) {
	clientHalf.ClientHalf = xorKeys(serverHalf.ServerHalf, key.Key)
	return
}

// UnmaskTLFCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, clientHalf TLFCryptKeyClientHalf) (key TLFCryptKey, err error) {
	key.Key = xorKeys(serverHalf.ServerHalf, clientHalf.ClientHalf)
	return
}

// UnmaskBlockCryptKey implements the Crypto interface for CryptoCommon.
func (c *CryptoCommon) UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf, tlfCryptKey TLFCryptKey) (key BlockCryptKey, error error) {
	key.Key = xorKeys(serverHalf.ServerHalf, tlfCryptKey.Key)
	return
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
func (c *CryptoCommon) EncryptTLFCryptKeyClientHalf(privateKey TLFEphemeralPrivateKey, publicKey CryptPublicKey, clientHalf TLFCryptKeyClientHalf) (encryptedClientHalf EncryptedTLFCryptKeyClientHalf, err error) {
	var nonce [24]byte
	err = cryptoRandRead(nonce[:])
	if err != nil {
		return
	}

	keypair, err := libkb.ImportKeypairFromKID(publicKey.KID)
	if err != nil {
		return
	}

	dhKeyPair, ok := keypair.(libkb.NaclDHKeyPair)
	if !ok {
		err = libkb.KeyCannotEncryptError{}
		return
	}

	encryptedData := box.Seal(nil, clientHalf.ClientHalf[:], &nonce, (*[32]byte)(&dhKeyPair.Public), (*[32]byte)(&privateKey.PrivateKey))

	encryptedClientHalf = EncryptedTLFCryptKeyClientHalf{
		Version:       TLFEncryptionBox,
		Nonce:         nonce[:],
		EncryptedData: encryptedData,
	}
	return
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
