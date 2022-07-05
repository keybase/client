// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/crypto/nacl/box"
)

// CryptoCommon contains many of the function implementations need for
// the Crypto interface, which can be reused by other implementations.
type CryptoCommon struct {
	codec               kbfscodec.Codec
	blockCryptVersioner blockCryptVersioner
}

var _ cryptoPure = (*CryptoCommon)(nil)

// MakeCryptoCommon returns a default CryptoCommon object.
func MakeCryptoCommon(
	codec kbfscodec.Codec,
	blockCryptVersioner blockCryptVersioner) CryptoCommon {
	return CryptoCommon{codec, blockCryptVersioner}
}

// MakeRandomTlfID implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeRandomTlfID(t tlf.Type) (tlf.ID, error) {
	return tlf.MakeRandomID(t)
}

// MakeRandomBranchID implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeRandomBranchID() (kbfsmd.BranchID, error) {
	return kbfsmd.MakeRandomBranchID()
}

// MakeTemporaryBlockID implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeTemporaryBlockID() (kbfsblock.ID, error) {
	return kbfsblock.MakeTemporaryID()
}

// MakeBlockRefNonce implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeBlockRefNonce() (nonce kbfsblock.RefNonce, err error) {
	return kbfsblock.MakeRefNonce()
}

// MakeRandomBlockCryptKeyServerHalf implements the Crypto interface
// for CryptoCommon.
func (c CryptoCommon) MakeRandomBlockCryptKeyServerHalf() (
	kbfscrypto.BlockCryptKeyServerHalf, error) {
	return kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
}

// MakeRandomTLFEphemeralKeys implements the Crypto interface for
// CryptoCommon.
func (c CryptoCommon) MakeRandomTLFEphemeralKeys() (
	kbfscrypto.TLFEphemeralPublicKey, kbfscrypto.TLFEphemeralPrivateKey,
	error) {
	return kbfscrypto.MakeRandomTLFEphemeralKeys()
}

// MakeRandomTLFKeys implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeRandomTLFKeys() (kbfscrypto.TLFPublicKey,
	kbfscrypto.TLFPrivateKey, kbfscrypto.TLFCryptKey, error) {
	publicKey, privateKey, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return kbfscrypto.TLFPublicKey{}, kbfscrypto.TLFPrivateKey{},
			kbfscrypto.TLFCryptKey{}, errors.WithStack(err)
	}

	pubKey := kbfscrypto.MakeTLFPublicKey(*publicKey)
	privKey := kbfscrypto.MakeTLFPrivateKey(*privateKey)

	cryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	if err != nil {
		return kbfscrypto.TLFPublicKey{}, kbfscrypto.TLFPrivateKey{},
			kbfscrypto.TLFCryptKey{}, err
	}

	return pubKey, privKey, cryptKey, nil
}

// EncryptPrivateMetadata implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) EncryptPrivateMetadata(
	pmd PrivateMetadata, key kbfscrypto.TLFCryptKey) (
	encryptedPmd kbfscrypto.EncryptedPrivateMetadata, err error) {
	encodedPmd, err := c.codec.Encode(pmd)
	if err != nil {
		return kbfscrypto.EncryptedPrivateMetadata{}, err
	}

	return kbfscrypto.EncryptEncodedPrivateMetadata(encodedPmd, key)
}

// DecryptPrivateMetadata implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) DecryptPrivateMetadata(
	encryptedPmd kbfscrypto.EncryptedPrivateMetadata, key kbfscrypto.TLFCryptKey) (
	PrivateMetadata, error) {
	encodedPrivateMetadata, err := kbfscrypto.DecryptPrivateMetadata(
		encryptedPmd, key)
	if err != nil {
		return PrivateMetadata{}, err
	}

	var pmd PrivateMetadata
	err = c.codec.Decode(encodedPrivateMetadata, &pmd)
	if err != nil {
		return PrivateMetadata{}, err
	}

	return pmd, nil
}

// EncryptBlock implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) EncryptBlock(
	block data.Block, tlfCryptKey kbfscrypto.TLFCryptKey,
	blockServerHalf kbfscrypto.BlockCryptKeyServerHalf) (
	plainSize int, encryptedBlock kbfscrypto.EncryptedBlock, err error) {
	encodedBlock, err := c.codec.Encode(block)
	if err != nil {
		return -1, kbfscrypto.EncryptedBlock{}, err
	}

	paddedBlock, err := kbfscrypto.PadBlock(encodedBlock)
	if err != nil {
		return -1, kbfscrypto.EncryptedBlock{}, err
	}

	encryptedBlock, err =
		kbfscrypto.EncryptPaddedEncodedBlock(
			paddedBlock, tlfCryptKey, blockServerHalf,
			c.blockCryptVersioner.BlockCryptVersion())
	if err != nil {
		return -1, kbfscrypto.EncryptedBlock{}, err
	}

	plainSize = len(encodedBlock)
	return plainSize, encryptedBlock, nil
}

// DecryptBlock implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) DecryptBlock(
	encryptedBlock kbfscrypto.EncryptedBlock,
	tlfCryptKey kbfscrypto.TLFCryptKey,
	blockServerHalf kbfscrypto.BlockCryptKeyServerHalf, block data.Block) error {
	var paddedBlock []byte
	paddedBlock, err := kbfscrypto.DecryptBlock(
		encryptedBlock, tlfCryptKey, blockServerHalf)
	if err != nil {
		return err
	}

	encodedBlock, err := kbfscrypto.DepadBlock(paddedBlock)
	if err != nil {
		return err
	}

	err = c.codec.Decode(encodedBlock, &block)
	if err != nil {
		return errors.WithStack(BlockDecodeError{err})
	}
	return nil
}
