// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/secretbox"
)

type simpleBlockCryptVersioner struct {
	t kbfscrypto.EncryptionVer
}

func (sbcv simpleBlockCryptVersioner) BlockCryptVersion() kbfscrypto.EncryptionVer {
	return sbcv.t
}

func makeBlockCryptV1() simpleBlockCryptVersioner {
	return simpleBlockCryptVersioner{kbfscrypto.EncryptionSecretbox}
}

func makeBlockCryptV2() simpleBlockCryptVersioner {
	return simpleBlockCryptVersioner{kbfscrypto.EncryptionSecretboxWithKeyNonce}
}

// Test (very superficially) that MakeRandomTLFEphemeralKeys() returns
// non-zero values that aren't equal.
func TestCryptoCommonRandomTLFEphemeralKeys(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	a1, a2, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)
	require.NotEqual(t, kbfscrypto.TLFEphemeralPublicKey{}, a1)
	require.NotEqual(t, kbfscrypto.TLFEphemeralPrivateKey{}, a2)

	b1, b2, err := c.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)
	require.NotEqual(t, kbfscrypto.TLFEphemeralPublicKey{}, b1)
	require.NotEqual(t, kbfscrypto.TLFEphemeralPrivateKey{}, b2)

	require.NotEqual(t, a1, b1)
	require.NotEqual(t, a2, b2)
}

// Test (very superficially) that MakeRandomTLFKeys() returns non-zero
// values that aren't equal.
func TestCryptoCommonRandomTLFKeys(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	a1, a2, a3, err := c.MakeRandomTLFKeys()
	require.NoError(t, err)
	require.NotEqual(t, kbfscrypto.TLFPublicKey{}, a1)
	require.NotEqual(t, kbfscrypto.TLFPrivateKey{}, a2)
	require.NotEqual(t, kbfscrypto.TLFCryptKey{}, a3)

	b1, b2, b3, err := c.MakeRandomTLFKeys()
	require.NoError(t, err)
	require.NotEqual(t, kbfscrypto.TLFPublicKey{}, b1)
	require.NotEqual(t, kbfscrypto.TLFPrivateKey{}, b2)
	require.NotEqual(t, kbfscrypto.TLFCryptKey{}, b3)

	require.NotEqual(t, a1, b1)
	require.NotEqual(t, a2, b2)
	require.NotEqual(t, a3, b3)
}

type TestBlock struct {
	A int
}

func (TestBlock) DataVersion() data.Ver {
	return data.FirstValidVer
}

func (tb TestBlock) GetEncodedSize() uint32 {
	return 0
}

func (tb TestBlock) SetEncodedSize(size uint32) {
}

func (tb TestBlock) NewEmpty() data.Block {
	return &TestBlock{}
}

func (tb TestBlock) NewEmptier() func() data.Block {
	return tb.NewEmpty
}

func (tb *TestBlock) Set(other data.Block) {
	otherTb := other.(*TestBlock)
	tb.A = otherTb.A
}

func (tb *TestBlock) ToCommonBlock() *data.CommonBlock {
	return nil
}

func (tb *TestBlock) IsIndirect() bool {
	return false
}

func (tb *TestBlock) IsTail() bool {
	return true
}

func (tb TestBlock) OffsetExceedsData(_, _ data.Offset) bool {
	return false
}

func (tb TestBlock) BytesCanBeDirtied() int64 {
	return 0
}

func TestCryptoCommonEncryptDecryptBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	block := TestBlock{42}
	tlfCryptKey := kbfscrypto.TLFCryptKey{}
	blockServerHalf := kbfscrypto.BlockCryptKeyServerHalf{}

	_, encryptedBlock, err := c.EncryptBlock(
		&block, tlfCryptKey, blockServerHalf)
	require.NoError(t, err)

	var decryptedBlock TestBlock
	err = c.DecryptBlock(
		encryptedBlock, tlfCryptKey, blockServerHalf, &decryptedBlock)
	require.NoError(t, err)
	require.Equal(t, block, decryptedBlock)
}

func checkSecretboxOpenPrivateMetadata(t *testing.T, encryptedPrivateMetadata kbfscrypto.EncryptedPrivateMetadata, key kbfscrypto.TLFCryptKey) (encodedData []byte) {
	require.Equal(
		t, kbfscrypto.EncryptionSecretbox, encryptedPrivateMetadata.Version)
	require.Equal(t, 24, len(encryptedPrivateMetadata.Nonce))

	var nonce [24]byte
	copy(nonce[:], encryptedPrivateMetadata.Nonce)
	require.NotEqual(t, [24]byte{}, nonce)

	keyData := key.Data()
	encodedData, ok := secretbox.Open(nil, encryptedPrivateMetadata.EncryptedData, &nonce, &keyData)
	require.True(t, ok)

	return encodedData
}

// Test that crypto.EncryptPrivateMetadata() encrypts its passed-in
// PrivateMetadata object properly.
func TestEncryptPrivateMetadata(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	_, tlfPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	require.NoError(t, err)

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}
	expectedEncodedPrivateMetadata, err := c.codec.Encode(privateMetadata)
	require.NoError(t, err)

	encryptedPrivateMetadata, err := c.EncryptPrivateMetadata(privateMetadata, cryptKey)
	require.NoError(t, err)

	encodedPrivateMetadata := checkSecretboxOpenPrivateMetadata(t, encryptedPrivateMetadata, cryptKey)

	require.Equal(t, expectedEncodedPrivateMetadata, encodedPrivateMetadata)
}

// Test that crypto.DecryptPrivateMetadata() decrypts an encrypted
// PrivateMetadata object.
func TestDecryptPrivateMetadata(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	c := MakeCryptoCommon(codec, makeBlockCryptV1())

	_, tlfPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	require.NoError(t, err)

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}

	encodedPrivateMetadata, err := codec.Encode(privateMetadata)
	require.NoError(t, err)

	encryptedPrivateMetadata, err := kbfscrypto.EncryptEncodedPrivateMetadata(
		encodedPrivateMetadata, cryptKey)
	require.NoError(t, err)

	decryptedPrivateMetadata, err := c.DecryptPrivateMetadata(
		encryptedPrivateMetadata, cryptKey)
	require.NoError(t, err)
	require.Equal(t, privateMetadata, decryptedPrivateMetadata)
}

func makeFakeBlockCryptKey(t *testing.T) (
	kbfscrypto.TLFCryptKey, kbfscrypto.BlockCryptKeyServerHalf,
	kbfscrypto.BlockCryptKey) {
	tlfCryptKey, err := kbfscrypto.MakeRandomTLFCryptKey()
	require.NoError(t, err)
	blockServerHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	key := kbfscrypto.UnmaskBlockCryptKey(blockServerHalf, tlfCryptKey)
	return tlfCryptKey, blockServerHalf, key
}

func checkSecretboxOpenBlock(t *testing.T, encryptedBlock kbfscrypto.EncryptedBlock, key kbfscrypto.BlockCryptKey) (encodedData []byte) {
	require.Equal(
		t, kbfscrypto.EncryptionSecretbox, encryptedBlock.Version)
	require.Equal(t, 24, len(encryptedBlock.Nonce))

	var nonce [24]byte
	copy(nonce[:], encryptedBlock.Nonce)
	require.NotEqual(t, [24]byte{}, nonce)

	keyData := key.Data()
	encodedData, ok := secretbox.Open(nil, encryptedBlock.EncryptedData, &nonce, &keyData)
	require.True(t, ok)

	return encodedData
}

// Test that crypto.EncryptBlock() encrypts its passed-in Block object
// properly.
func TestEncryptBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	tlfCryptKey, blockServerHalf, cryptKey := makeFakeBlockCryptKey(t)

	block := TestBlock{50}
	expectedEncodedBlock, err := c.codec.Encode(block)
	require.NoError(t, err)

	plainSize, encryptedBlock, err := c.EncryptBlock(
		&block, tlfCryptKey, blockServerHalf)
	require.NoError(t, err)
	require.Equal(t, len(expectedEncodedBlock), plainSize)

	paddedBlock := checkSecretboxOpenBlock(t, encryptedBlock, cryptKey)
	encodedBlock, err := kbfscrypto.DepadBlock(paddedBlock)
	require.NoError(t, err)
	require.Equal(t, expectedEncodedBlock, encodedBlock)
}

func testDecryptEncryptedBlock(t *testing.T, c CryptoCommon) {
	tlfCryptKey, blockServerHalf, _ := makeFakeBlockCryptKey(t)

	block := TestBlock{50}

	_, encryptedBlock, err := c.EncryptBlock(
		&block, tlfCryptKey, blockServerHalf)
	require.NoError(t, err)

	require.Equal(
		t, c.blockCryptVersioner.BlockCryptVersion(), encryptedBlock.Version)

	var decryptedBlock TestBlock
	err = c.DecryptBlock(
		encryptedBlock, tlfCryptKey, blockServerHalf, &decryptedBlock)
	require.NoError(t, err)
	require.Equal(t, block, decryptedBlock)
}

// Test that crypto.DecryptBlock() decrypts a encrypted Block object.
func TestDecryptEncryptedBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())
	testDecryptEncryptedBlock(t, c)
}

// Test that crypto.DecryptBlock() decrypts a V2-encrypted Block object.
func TestDecryptV2EncryptedBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV2())
	testDecryptEncryptedBlock(t, c)
}

// Test that secretbox encrypted data length is a deterministic
// function of the input data length.
func TestSecretboxEncryptedLen(t *testing.T) {
	const startSize = 100
	const endSize = 100000
	const iterations = 5

	// Generating random data is slow, so do it all up-front and
	// index into it. Note that we're intentionally re-using most
	// of the data between iterations intentionally.
	randomData := make([]byte, endSize+iterations)
	err := kbfscrypto.RandRead(randomData)
	require.NoError(t, err)

	cryptKeys := make([]kbfscrypto.TLFCryptKey, iterations)
	serverHalfs := make([]kbfscrypto.BlockCryptKeyServerHalf, iterations)
	for j := 0; j < iterations; j++ {
		cryptKeys[j], serverHalfs[j], _ = makeFakeBlockCryptKey(t)
	}

	for i := startSize; i < endSize; i += 1000 {
		var enclen int
		for j := 0; j < iterations; j++ {
			data := randomData[j : j+i]
			enc, err := kbfscrypto.EncryptPaddedEncodedBlock(
				data, cryptKeys[j], serverHalfs[j],
				kbfscrypto.EncryptionSecretboxWithKeyNonce)
			require.NoError(t, err)
			if j == 0 {
				enclen = len(enc.EncryptedData)
			} else {
				assert.Equal(t, len(enc.EncryptedData), enclen)
			}
		}
	}
}

type testBlockArray []byte

func (tba testBlockArray) GetEncodedSize() uint32 {
	return 0
}

func (tba testBlockArray) SetEncodedSize(size uint32) {
}

func (testBlockArray) DataVersion() data.Ver {
	return data.FirstValidVer
}

func (tba testBlockArray) NewEmpty() data.Block {
	return &testBlockArray{}
}

func (tba testBlockArray) NewEmptier() func() data.Block {
	return tba.NewEmpty
}

func (tba testBlockArray) ToCommonBlock() *data.CommonBlock {
	return nil
}

func (tba *testBlockArray) Set(other data.Block) {
	otherTba := other.(*testBlockArray)
	*tba = *otherTba
}

func (tba testBlockArray) IsIndirect() bool {
	return false
}

func (tba *testBlockArray) IsTail() bool {
	return true
}

func (tba testBlockArray) OffsetExceedsData(_, _ data.Offset) bool {
	return false
}

func (tba testBlockArray) BytesCanBeDirtied() int64 {
	return 0
}

// Test that block encrypted data length is the same for data
// length within same power of 2.
func TestBlockEncryptedLen(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())
	tlfCryptKey, blockServerHalf, _ := makeFakeBlockCryptKey(t)

	const startSize = 1025
	const endSize = 2000

	// Generating random data is slow, so do it all up-front and
	// index into it. Note that we're intentionally re-using most
	// of the data between iterations intentionally.
	randomData := make(testBlockArray, endSize)
	err := kbfscrypto.RandRead(randomData)
	require.NoError(t, err)

	var expectedLen int
	for i := startSize; i < endSize; i++ {
		data := randomData[:i]
		_, encBlock, err := c.EncryptBlock(&data, tlfCryptKey, blockServerHalf)
		require.NoError(t, err)

		if expectedLen == 0 {
			expectedLen = len(encBlock.EncryptedData)
			continue
		}
		require.Equal(t, expectedLen, len(encBlock.EncryptedData))
	}
}

func benchmarkEncryptBlock(b *testing.B, blockSize int) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())

	// Fill in the block with varying data to make sure not to
	// trigger any encoding optimizations.
	buf := make([]byte, 512<<10)
	for i := 0; i < len(buf); i++ {
		buf[i] = byte(i)
	}
	block := data.FileBlock{
		Contents: buf,
	}
	tlfCryptKey := kbfscrypto.TLFCryptKey{}
	blockServerHalf := kbfscrypto.BlockCryptKeyServerHalf{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := c.EncryptBlock(&block, tlfCryptKey, blockServerHalf)
		require.NoError(b, err)
	}
}

func BenchmarkEncryptBlock(b *testing.B) {
	blockSizes := []int{
		0,
		1024,
		32 * 1024,
		512 * 1024,
	}
	for _, blockSize := range blockSizes {
		// Capture range variable.
		blockSize := blockSize
		b.Run(fmt.Sprintf("blockSize=%d", blockSize),
			func(b *testing.B) {
				benchmarkEncryptBlock(b, blockSize)
			})
	}
}
