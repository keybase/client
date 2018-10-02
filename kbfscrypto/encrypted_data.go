// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"reflect"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/cache"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/pkg/errors"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"
)

// EncryptionVer denotes a version for the encryption method.
type EncryptionVer int

const (
	// EncryptionSecretbox is the encryption version that uses
	// nacl/secretbox or nacl/box.
	EncryptionSecretbox EncryptionVer = 1
	// EncryptionSecretboxWithKeyNonce is the encryption version that
	// uses nacl/secretbox or nacl/box, with a nonce derived from a
	// secret key.
	EncryptionSecretboxWithKeyNonce EncryptionVer = 2
)

func (v EncryptionVer) String() string {
	switch v {
	case EncryptionSecretbox:
		return "EncryptionSecretbox"
	default:
		return fmt.Sprintf("EncryptionVer(%d)", v)
	}
}

// encryptedData is encrypted data with a nonce and a version.
type encryptedData struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	Version       EncryptionVer `codec:"v"`
	EncryptedData []byte        `codec:"e"`
	Nonce         []byte        `codec:"n"`
}

// Size implements the cache.Measurable interface.
func (ed encryptedData) Size() int {
	return cache.IntSize /* ed.Version */ +
		cache.PtrSize + len(ed.EncryptedData) + cache.PtrSize + len(ed.Nonce)
}

func (ed encryptedData) String() string {
	if reflect.DeepEqual(ed, encryptedData{}) {
		return "EncryptedData{}"
	}
	return fmt.Sprintf("%s{data=%s, nonce=%s}",
		ed.Version, hex.EncodeToString(ed.EncryptedData),
		hex.EncodeToString(ed.Nonce))
}

// encryptDataWithNonce encrypts the given data with the given
// symmetric key and nonce.
func encryptDataWithNonce(
	data []byte, key [32]byte, nonce [24]byte, ver EncryptionVer) (
	encryptedData, error) {
	sealedData := secretbox.Seal(nil, data, &nonce, &key)

	return encryptedData{
		Version:       ver,
		Nonce:         nonce[:],
		EncryptedData: sealedData,
	}, nil
}

// encryptData encrypts the given data with the given symmetric key.
func encryptData(data []byte, key [32]byte) (encryptedData, error) {
	var nonce [24]byte
	err := RandRead(nonce[:])
	if err != nil {
		return encryptedData{}, err
	}

	return encryptDataWithNonce(data, key, nonce, EncryptionSecretbox)
}

// decryptDataWithNonce decrypts the given encrypted data with the
// given symmetric key and nonce.
func decryptDataWithNonce(
	encryptedData encryptedData, key [32]byte, nonce [24]byte) ([]byte, error) {
	decryptedData, ok := secretbox.Open(
		nil, encryptedData.EncryptedData, &nonce, &key)
	if !ok {
		return nil, errors.WithStack(libkb.DecryptionError{})
	}

	return decryptedData, nil
}

// decryptData decrypts the given encrypted data with the given
// symmetric key.
func decryptData(encryptedData encryptedData, key [32]byte) ([]byte, error) {
	switch encryptedData.Version {
	case EncryptionSecretbox, EncryptionSecretboxWithKeyNonce:
	// We're good.
	default:
		return nil, errors.WithStack(
			UnknownEncryptionVer{encryptedData.Version})
	}

	// For v2, the caller must have already checked the nonce.
	var nonce [24]byte
	if len(encryptedData.Nonce) != len(nonce) {
		return nil, errors.WithStack(
			InvalidNonceError{encryptedData.Nonce})
	}
	copy(nonce[:], encryptedData.Nonce)

	return decryptDataWithNonce(encryptedData, key, nonce)
}

// EncryptedTLFCryptKeyClientHalf is an encrypted
// TLFCryptKeyClientHalf object.
type EncryptedTLFCryptKeyClientHalf struct {
	encryptedData
}

// EncryptTLFCryptKeyClientHalf encrypts a TLFCryptKeyClientHalf
// using both a TLF's ephemeral private key and a device pubkey.
func EncryptTLFCryptKeyClientHalf(
	privateKey TLFEphemeralPrivateKey, publicKey CryptPublicKey,
	clientHalf TLFCryptKeyClientHalf) (
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf, err error) {
	var nonce [24]byte
	err = RandRead(nonce[:])
	if err != nil {
		return EncryptedTLFCryptKeyClientHalf{}, err
	}

	keypair, err := libkb.ImportKeypairFromKID(publicKey.KID())
	if err != nil {
		return EncryptedTLFCryptKeyClientHalf{}, errors.WithStack(err)
	}

	dhKeyPair, ok := keypair.(libkb.NaclDHKeyPair)
	if !ok {
		return EncryptedTLFCryptKeyClientHalf{}, errors.WithStack(
			libkb.KeyCannotEncryptError{})
	}

	clientHalfData := clientHalf.Data()
	privateKeyData := privateKey.Data()
	encryptedBytes := box.Seal(nil, clientHalfData[:], &nonce, (*[32]byte)(&dhKeyPair.Public), &privateKeyData)

	return EncryptedTLFCryptKeyClientHalf{
		encryptedData{
			Version:       EncryptionSecretbox,
			EncryptedData: encryptedBytes,
			Nonce:         nonce[:],
		},
	}, nil
}

// EncryptedPrivateMetadata is an encrypted PrivateMetadata object.
type EncryptedPrivateMetadata struct {
	encryptedData
}

// EncryptEncodedPrivateMetadata encrypts an encoded PrivateMetadata
// object.
func EncryptEncodedPrivateMetadata(encodedPrivateMetadata []byte, key TLFCryptKey) (
	encryptedPrivateMetadata EncryptedPrivateMetadata, err error) {
	encryptedData, err := encryptData(encodedPrivateMetadata, key.Data())
	if err != nil {
		return EncryptedPrivateMetadata{}, err
	}

	return EncryptedPrivateMetadata{encryptedData}, nil
}

// DecryptPrivateMetadata decrypts a PrivateMetadata object, but does
// not decode it.
func DecryptPrivateMetadata(
	encryptedPrivateMetadata EncryptedPrivateMetadata, key TLFCryptKey) (
	[]byte, error) {
	if encryptedPrivateMetadata.encryptedData.Version ==
		EncryptionSecretboxWithKeyNonce {
		// Only blocks should have v2 encryption.
		return nil, errors.WithStack(InvalidEncryptionVer{
			encryptedPrivateMetadata.encryptedData.Version})
	}

	return decryptData(encryptedPrivateMetadata.encryptedData, key.Data())
}

// EncryptedBlock is an encrypted Block object.
type EncryptedBlock struct {
	encryptedData
}

// EncryptPaddedEncodedBlock encrypts a padded, encoded block.
func EncryptPaddedEncodedBlock(paddedEncodedBlock []byte, key BlockCryptKey) (
	encryptedBlock EncryptedBlock, err error) {
	encryptedData, err := encryptData(paddedEncodedBlock, key.Data())
	if err != nil {
		return EncryptedBlock{}, err
	}

	return EncryptedBlock{encryptedData}, nil
}

func keyAndNonceFromBlockCryptKey(key BlockCryptKey) (
	encKey [32]byte, nonce [24]byte) {
	// Hash the full key with SHA-512 to get 64 bytes.
	keyData := key.Data()
	h := sha512.Sum512(keyData[:])
	copy(encKey[:], h[:32])
	copy(nonce[:], h[32:56])
	return encKey, nonce
}

// EncryptPaddedEncodedBlockV2 encrypts a padded, encoded block, using
// the v2 block encryption scheme.
func EncryptPaddedEncodedBlockV2(paddedEncodedBlock []byte, key BlockCryptKey) (
	encryptedBlock EncryptedBlock, err error) {
	encKey, nonce := keyAndNonceFromBlockCryptKey(key)

	encryptedData, err := encryptDataWithNonce(
		paddedEncodedBlock, encKey, nonce, EncryptionSecretboxWithKeyNonce)
	if err != nil {
		return EncryptedBlock{}, err
	}

	return EncryptedBlock{encryptedData}, nil
}

// DecryptBlock decrypts a block, but does not unpad or decode it.
func DecryptBlock(encryptedBlock EncryptedBlock, key BlockCryptKey) (
	[]byte, error) {
	keyData := key.Data()
	if encryptedBlock.encryptedData.Version == EncryptionSecretboxWithKeyNonce {
		var nonce [24]byte
		keyData, nonce = keyAndNonceFromBlockCryptKey(key)

		// Make sure the nonce in the encrypted data matches the
		// computed nonce.
		if !bytes.Equal(nonce[:], encryptedBlock.encryptedData.Nonce) {
			return nil, errors.WithStack(
				InvalidNonceError{encryptedBlock.encryptedData.Nonce})
		}
	}

	return decryptData(encryptedBlock.encryptedData, keyData)
}

// EncryptedTLFCryptKeys is an encrypted TLFCryptKey array.
type EncryptedTLFCryptKeys struct {
	encryptedData
}

// EncryptTLFCryptKeys encrypts a TLFCryptKey array.
func EncryptTLFCryptKeys(codec kbfscodec.Codec, oldKeys []TLFCryptKey, key TLFCryptKey) (
	encryptedTLFCryptKeys EncryptedTLFCryptKeys, err error) {
	encodedKeys, err := codec.Encode(oldKeys)
	if err != nil {
		return EncryptedTLFCryptKeys{}, err
	}

	encryptedData, err := encryptData(encodedKeys, key.Data())
	if err != nil {
		return EncryptedTLFCryptKeys{}, err
	}

	return EncryptedTLFCryptKeys{encryptedData}, nil
}

// DecryptTLFCryptKeys decrypts a TLFCryptKey array, but does not
// decode it.
func DecryptTLFCryptKeys(
	codec kbfscodec.Codec, encryptedTLFCryptKeys EncryptedTLFCryptKeys, key TLFCryptKey) (
	[]TLFCryptKey, error) {
	if encryptedTLFCryptKeys.encryptedData.Version ==
		EncryptionSecretboxWithKeyNonce {
		// Only blocks should have v2 encryption.
		return nil, errors.WithStack(
			InvalidEncryptionVer{encryptedTLFCryptKeys.encryptedData.Version})
	}

	encodedKeys, err := decryptData(encryptedTLFCryptKeys.encryptedData, key.Data())
	if err != nil {
		return nil, err
	}

	var oldKeys []TLFCryptKey
	err = codec.Decode(encodedKeys, &oldKeys)
	if err != nil {
		return nil, err
	}

	return oldKeys, nil
}

// EncryptedMerkleLeaf is an encrypted MerkleLeaf object.
type EncryptedMerkleLeaf struct {
	encryptedData
}

// MakeEncryptedMerkleLeaf constructs an EncryptedMerkleLeaf.
func MakeEncryptedMerkleLeaf(
	version EncryptionVer, data []byte, nonce *[24]byte) EncryptedMerkleLeaf {
	return EncryptedMerkleLeaf{
		encryptedData{
			Version:       version,
			EncryptedData: data,
			Nonce:         nonce[:],
		},
	}
}

// PrepareMerkleLeaf verifies the correctness of the given leaf, and
// returns its nonce.
func PrepareMerkleLeaf(encryptedMerkleLeaf EncryptedMerkleLeaf) (
	nonce [24]byte, err error) {
	if encryptedMerkleLeaf.Version != EncryptionSecretbox {
		return nonce,
			errors.WithStack(UnknownEncryptionVer{
				Ver: encryptedMerkleLeaf.Version})
	}

	if len(encryptedMerkleLeaf.Nonce) != len(nonce) {
		return nonce,
			errors.WithStack(InvalidNonceError{
				Nonce: encryptedMerkleLeaf.Nonce})
	}
	copy(nonce[:], encryptedMerkleLeaf.Nonce)
	return nonce, nil
}

// DecryptMerkleLeaf decrypts an EncryptedMerkleLeaf using the given
// private TLF key and ephemeral public key.
func DecryptMerkleLeaf(
	privateKey TLFPrivateKey, publicKey TLFEphemeralPublicKey,
	encryptedMerkleLeaf EncryptedMerkleLeaf) ([]byte, error) {
	nonce, err := PrepareMerkleLeaf(encryptedMerkleLeaf)
	if err != nil {
		return nil, err
	}

	publicKeyData := publicKey.Data()
	privateKeyData := privateKey.Data()
	decryptedData, ok := box.Open(nil, encryptedMerkleLeaf.EncryptedData,
		&nonce, &publicKeyData, &privateKeyData)
	if !ok {
		return nil, errors.WithStack(libkb.DecryptionError{})
	}
	return decryptedData, nil
}
