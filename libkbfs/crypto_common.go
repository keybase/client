// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"encoding/binary"
	"io"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/crypto/nacl/box"
)

// CryptoCommon contains many of the function implementations need for
// the Crypto interface, which can be reused by other implementations.
type CryptoCommon struct {
	codec kbfscodec.Codec
}

var _ cryptoPure = (*CryptoCommon)(nil)

// MakeCryptoCommon returns a default CryptoCommon object.
func MakeCryptoCommon(codec kbfscodec.Codec) CryptoCommon {
	return CryptoCommon{codec}
}

// MakeRandomTlfID implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeRandomTlfID(t tlf.Type) (tlf.ID, error) {
	return tlf.MakeRandomID(t)
}

// MakeRandomBranchID implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) MakeRandomBranchID() (BranchID, error) {
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
	encryptedPmd EncryptedPrivateMetadata, err error) {
	encodedPmd, err := c.codec.Encode(pmd)
	if err != nil {
		return EncryptedPrivateMetadata{}, err
	}

	return kbfscrypto.EncryptEncodedPrivateMetadata(encodedPmd, key)
}

// DecryptPrivateMetadata implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) DecryptPrivateMetadata(
	encryptedPmd EncryptedPrivateMetadata, key kbfscrypto.TLFCryptKey) (
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

const minBlockSize = 256

// powerOfTwoEqualOrGreater returns smallest power of 2 greater than or equal
// to the input n.
// https://en.wikipedia.org/wiki/Power_of_two#Algorithm_to_round_up_to_power_of_two
func powerOfTwoEqualOrGreater(n int) int {
	if n <= minBlockSize {
		return minBlockSize
	}
	if n&(n-1) == 0 {
		// if n is already power of 2, return it
		return n
	}

	n--
	n = n | (n >> 1)
	n = n | (n >> 2)
	n = n | (n >> 4)
	n = n | (n >> 8)
	n = n | (n >> 16)
	n = n | (n >> 16 >> 16) // make it work with 64 bit int; no effect on 32bit.
	n++

	return n
}

const padPrefixSize = 4

// padBlock adds zero padding to an encoded block.
func (c CryptoCommon) padBlock(block []byte) ([]byte, error) {
	totalLen := powerOfTwoEqualOrGreater(len(block))

	buf := make([]byte, padPrefixSize+totalLen)
	binary.LittleEndian.PutUint32(buf, uint32(len(block)))

	copy(buf[padPrefixSize:], block)
	return buf, nil
}

// depadBlock extracts the actual block data from a padded block.
func (c CryptoCommon) depadBlock(paddedBlock []byte) ([]byte, error) {
	totalLen := len(paddedBlock)
	if totalLen < padPrefixSize {
		return nil, errors.WithStack(io.ErrUnexpectedEOF)
	}

	blockLen := binary.LittleEndian.Uint32(paddedBlock)
	blockEndPos := int(blockLen + padPrefixSize)

	if totalLen < blockEndPos {
		return nil, errors.WithStack(
			PaddedBlockReadError{
				ActualLen:   totalLen,
				ExpectedLen: blockEndPos,
			})
	}
	return paddedBlock[padPrefixSize:blockEndPos], nil
}

// EncryptBlock implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) EncryptBlock(block Block, key kbfscrypto.BlockCryptKey) (
	plainSize int, encryptedBlock EncryptedBlock, err error) {
	encodedBlock, err := c.codec.Encode(block)
	if err != nil {
		return -1, EncryptedBlock{}, err
	}

	paddedBlock, err := c.padBlock(encodedBlock)
	if err != nil {
		return -1, EncryptedBlock{}, err
	}

	encryptedBlock, err =
		kbfscrypto.EncryptPaddedEncodedBlock(paddedBlock, key)
	if err != nil {
		return -1, EncryptedBlock{}, err
	}

	plainSize = len(encodedBlock)
	return plainSize, encryptedBlock, nil
}

// DecryptBlock implements the Crypto interface for CryptoCommon.
func (c CryptoCommon) DecryptBlock(
	encryptedBlock EncryptedBlock, key kbfscrypto.BlockCryptKey,
	block Block) error {
	paddedBlock, err := kbfscrypto.DecryptBlock(encryptedBlock, key)
	if err != nil {
		return err
	}

	encodedBlock, err := c.depadBlock(paddedBlock)
	if err != nil {
		return err
	}

	err = c.codec.Decode(encodedBlock, &block)
	if err != nil {
		return errors.WithStack(BlockDecodeError{err})
	}
	return nil
}
