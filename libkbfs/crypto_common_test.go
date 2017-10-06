// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"fmt"
	"testing"
	"testing/quick"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test (very superficially) that MakeRandomTLFEphemeralKeys() returns
// non-zero values that aren't equal.
func TestCryptoCommonRandomTLFEphemeralKeys(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

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
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

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

func (TestBlock) DataVersion() DataVer {
	return FirstValidDataVer
}

func (tb TestBlock) GetEncodedSize() uint32 {
	return 0
}

func (tb TestBlock) SetEncodedSize(size uint32) {
}

func (tb TestBlock) NewEmpty() Block {
	return &TestBlock{}
}

func (tb *TestBlock) Set(other Block) {
	otherTb := other.(*TestBlock)
	tb.A = otherTb.A
}

func (tb *TestBlock) ToCommonBlock() *CommonBlock {
	return nil
}

func TestCryptoCommonEncryptDecryptBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

	block := TestBlock{42}
	key := kbfscrypto.BlockCryptKey{}

	_, encryptedBlock, err := c.EncryptBlock(&block, key)
	require.NoError(t, err)

	var decryptedBlock TestBlock
	err = c.DecryptBlock(encryptedBlock, key, &decryptedBlock)
	require.NoError(t, err)
	require.Equal(t, block, decryptedBlock)
}

func checkSecretboxOpenPrivateMetadata(t *testing.T, encryptedPrivateMetadata kbfscrypto.EncryptedPrivateMetadata, key kbfscrypto.TLFCryptKey) (encodedData []byte) {
	require.Equal(t, EncryptionSecretbox, encryptedPrivateMetadata.Version)
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
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

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
	c := MakeCryptoCommon(codec)

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

func makeFakeBlockCryptKey(t *testing.T) kbfscrypto.BlockCryptKey {
	var blockCryptKeyData [32]byte
	err := kbfscrypto.RandRead(blockCryptKeyData[:])
	blockCryptKey := kbfscrypto.MakeBlockCryptKey(blockCryptKeyData)
	require.NoError(t, err)
	return blockCryptKey
}

func checkSecretboxOpenBlock(t *testing.T, encryptedBlock kbfscrypto.EncryptedBlock, key kbfscrypto.BlockCryptKey) (encodedData []byte) {
	require.Equal(t, EncryptionSecretbox, encryptedBlock.Version)
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
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

	cryptKey := makeFakeBlockCryptKey(t)

	block := TestBlock{50}
	expectedEncodedBlock, err := c.codec.Encode(block)
	require.NoError(t, err)

	plainSize, encryptedBlock, err := c.EncryptBlock(&block, cryptKey)
	require.NoError(t, err)
	require.Equal(t, len(expectedEncodedBlock), plainSize)

	paddedBlock := checkSecretboxOpenBlock(t, encryptedBlock, cryptKey)
	encodedBlock, err := c.depadBlock(paddedBlock)
	require.NoError(t, err)
	require.Equal(t, expectedEncodedBlock, encodedBlock)
}

// Test that crypto.DecryptBlock() decrypts a encrypted Block object.
func TestDecryptEncryptedBlock(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

	cryptKey := makeFakeBlockCryptKey(t)

	block := TestBlock{50}

	_, encryptedBlock, err := c.EncryptBlock(&block, cryptKey)
	require.NoError(t, err)

	var decryptedBlock TestBlock
	err = c.DecryptBlock(encryptedBlock, cryptKey, &decryptedBlock)
	require.NoError(t, err)
	require.Equal(t, block, decryptedBlock)
}

// Test padding of blocks results in a larger block, with length
// equal to power of 2 + 4.
func TestBlockPadding(t *testing.T) {
	var c CryptoCommon
	f := func(b []byte) bool {
		padded, err := c.padBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		n := len(padded)
		if n <= len(b) {
			t.Logf("padBlock padded block len %d <= input block len %d", n, len(b))
			return false
		}
		// len of slice without uint32 prefix:
		h := n - 4
		if h&(h-1) != 0 {
			t.Logf("padBlock padded block len %d not a power of 2", h)
			return false
		}
		return true
	}

	err := quick.Check(f, nil)
	require.NoError(t, err)
}

// Tests padding -> depadding results in same block data.
func TestBlockDepadding(t *testing.T) {
	var c CryptoCommon
	f := func(b []byte) bool {
		padded, err := c.padBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		depadded, err := c.depadBlock(padded)
		if err != nil {
			t.Logf("depadBlock err: %s", err)
			return false
		}
		if !bytes.Equal(b, depadded) {
			return false
		}
		return true
	}

	err := quick.Check(f, nil)
	require.NoError(t, err)
}

// Test padding of blocks results in blocks at least 2^8.
func TestBlockPadMinimum(t *testing.T) {
	var c CryptoCommon
	for i := 0; i < 256; i++ {
		b := make([]byte, i)
		err := kbfscrypto.RandRead(b)
		require.NoError(t, err)
		padded, err := c.padBlock(b)
		require.NoError(t, err)
		require.Equal(t, 260, len(padded))
	}
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

	cryptKeys := make([]kbfscrypto.BlockCryptKey, iterations)
	for j := 0; j < iterations; j++ {
		cryptKeys[j] = makeFakeBlockCryptKey(t)
	}

	for i := startSize; i < endSize; i += 1000 {
		var enclen int
		for j := 0; j < iterations; j++ {
			data := randomData[j : j+i]
			enc, err := kbfscrypto.EncryptPaddedEncodedBlock(data, cryptKeys[j])
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

func (testBlockArray) DataVersion() DataVer { return FirstValidDataVer }

func (tba testBlockArray) NewEmpty() Block {
	return &testBlockArray{}
}

func (tba testBlockArray) ToCommonBlock() *CommonBlock {
	return nil
}

func (tba *testBlockArray) Set(other Block) {
	otherTba := other.(*testBlockArray)
	*tba = *otherTba
}

// Test that block encrypted data length is the same for data
// length within same power of 2.
func TestBlockEncryptedLen(t *testing.T) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())
	cryptKey := makeFakeBlockCryptKey(t)

	const startSize = 1025
	const endSize = 2000

	// Generating random data is slow, so do it all up-front and
	// index into it. Note that we're intentionally re-using most
	// of the data between iterations intentionally.
	randomData := make(testBlockArray, endSize)
	err := kbfscrypto.RandRead(randomData)
	require.NoError(t, err)

	var expectedLen int
	for i := 1025; i < 2000; i++ {
		data := randomData[:i]
		_, encBlock, err := c.EncryptBlock(&data, cryptKey)
		require.NoError(t, err)

		if expectedLen == 0 {
			expectedLen = len(encBlock.EncryptedData)
			continue
		}
		require.Equal(t, expectedLen, len(encBlock.EncryptedData))
	}
}

func benchmarkEncryptBlock(b *testing.B, blockSize int) {
	c := MakeCryptoCommon(kbfscodec.NewMsgpack())

	// Fill in the block with varying data to make sure not to
	// trigger any encoding optimizations.
	data := make([]byte, 512<<10)
	for i := 0; i < len(data); i++ {
		data[i] = byte(i)
	}
	block := FileBlock{
		Contents: data,
	}
	key := kbfscrypto.BlockCryptKey{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c.EncryptBlock(&block, key)
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
