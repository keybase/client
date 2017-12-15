// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/box"
)

func TestEncryptDecryptDataSuccess(t *testing.T) {
	data := []byte{0x20, 0x30}
	key := [32]byte{0x40, 0x45}
	encryptedData, err := encryptData(data, key)
	require.NoError(t, err)

	decryptedData, err := decryptData(encryptedData, key)
	require.NoError(t, err)
	require.Equal(t, data, decryptedData)
}

func TestDecryptDataFailure(t *testing.T) {
	// Test various failure cases for decryptMetadata().
	data := []byte{0x20, 0x30}
	key := [32]byte{0x40, 0x45}
	encryptedData, err := encryptData(data, key)
	require.NoError(t, err)

	// Wrong version.

	encryptedDataWrongVersion := encryptedData
	encryptedDataWrongVersion.Version++
	_, err = decryptData(encryptedDataWrongVersion, key)
	assert.Equal(t,
		UnknownEncryptionVer{encryptedDataWrongVersion.Version},
		errors.Cause(err))

	// Wrong nonce size.

	encryptedDataWrongNonceSize := encryptedData
	encryptedDataWrongNonceSize.Nonce = encryptedDataWrongNonceSize.Nonce[:len(encryptedDataWrongNonceSize.Nonce)-1]
	_, err = decryptData(encryptedDataWrongNonceSize, key)
	assert.Equal(t,
		InvalidNonceError{encryptedDataWrongNonceSize.Nonce},
		errors.Cause(err))

	// Corrupt key.

	keyCorrupt := key
	keyCorrupt[0] = ^keyCorrupt[0]
	_, err = decryptData(encryptedData, keyCorrupt)
	assert.Equal(t, libkb.DecryptionError{}, errors.Cause(err))

	// Corrupt data.

	encryptedDataCorruptData := encryptedData
	encryptedDataCorruptData.EncryptedData[0] = ^encryptedDataCorruptData.EncryptedData[0]
	_, err = decryptData(encryptedDataCorruptData, key)
	assert.Equal(t, libkb.DecryptionError{}, errors.Cause(err))
}

// Test that EncryptTLFCryptKeyClientHalf() encrypts its passed-in
// client half properly.
func TestCryptoCommonEncryptTLFCryptKeyClientHalf(t *testing.T) {
	ephPublicKey, ephPrivateKey, err := MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)

	cryptKey, err := MakeRandomTLFCryptKey()
	require.NoError(t, err)

	privateKey := MakeFakeCryptPrivateKeyOrBust("fake key")
	publicKey := privateKey.GetPublicKey()

	serverHalf, err := MakeRandomTLFCryptKeyServerHalf()
	require.NoError(t, err)

	clientHalf := MaskTLFCryptKey(serverHalf, cryptKey)

	encryptedClientHalf, err := EncryptTLFCryptKeyClientHalf(ephPrivateKey, publicKey, clientHalf)
	require.NoError(t, err)
	require.Equal(t, EncryptionSecretbox, encryptedClientHalf.Version)

	expectedEncryptedLength := len(clientHalf.Data()) + box.Overhead
	require.Equal(t, expectedEncryptedLength,
		len(encryptedClientHalf.EncryptedData))
	require.Equal(t, 24, len(encryptedClientHalf.Nonce))

	var nonce [24]byte
	copy(nonce[:], encryptedClientHalf.Nonce)
	require.NotEqual(t, [24]byte{}, nonce)

	ephPublicKeyData := ephPublicKey.Data()
	privateKeyData := privateKey.Data()
	decryptedData, ok := box.Open(
		nil, encryptedClientHalf.EncryptedData, &nonce,
		&ephPublicKeyData, &privateKeyData)
	require.True(t, ok)

	require.Equal(t, len(clientHalf.Data()), len(decryptedData))

	var clientHalf2Data [32]byte
	copy(clientHalf2Data[:], decryptedData)
	clientHalf2 := MakeTLFCryptKeyClientHalf(clientHalf2Data)
	require.Equal(t, clientHalf, clientHalf2)
}
