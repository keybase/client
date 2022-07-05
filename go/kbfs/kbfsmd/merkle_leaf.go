// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	merkle "github.com/keybase/go-merkle-tree"
	"golang.org/x/crypto/nacl/box"
)

// MerkleLeaf is the value of a Merkle leaf node.
type MerkleLeaf struct {
	_struct   bool `codec:",toarray"` // nolint
	Revision  Revision
	Hash      MerkleHash // hash of the signed metadata object
	Timestamp int64
}

var _ merkle.ValueConstructor = (*MerkleLeaf)(nil)

// Construct implements the go-merkle-tree.ValueConstructor interface.
func (l MerkleLeaf) Construct() interface{} {
	// In the Merkle tree leaves are simply byte slices.
	return &[]byte{}
}

// EncryptedMerkleLeaf is an encrypted Merkle leaf.
type EncryptedMerkleLeaf struct {
	_struct       bool `codec:",toarray"` // nolint
	Version       kbfscrypto.EncryptionVer
	EncryptedData []byte
}

// Construct implements the go-merkle-tree.ValueConstructor interface.
func (el EncryptedMerkleLeaf) Construct() interface{} {
	// In the Merkle tree leaves are simply byte slices.
	return &[]byte{}
}

// Encrypt encrypts a Merkle leaf node with the given key pair.
func (l MerkleLeaf) Encrypt(codec kbfscodec.Codec,
	pubKey kbfscrypto.TLFPublicKey, nonce *[24]byte,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey) (EncryptedMerkleLeaf, error) {
	// encode the clear-text leaf
	leafBytes, err := codec.Encode(l)
	if err != nil {
		return EncryptedMerkleLeaf{}, err
	}
	// encrypt the encoded leaf
	pubKeyData := pubKey.Data()
	privKeyData := ePrivKey.Data()
	encryptedData := box.Seal(
		nil, leafBytes, nonce, &pubKeyData, &privKeyData)
	return EncryptedMerkleLeaf{
		Version:       kbfscrypto.EncryptionSecretbox,
		EncryptedData: encryptedData,
	}, nil
}

// Decrypt decrypts a Merkle leaf node with the given key pair.
func (el EncryptedMerkleLeaf) Decrypt(codec kbfscodec.Codec,
	privKey kbfscrypto.TLFPrivateKey, nonce *[24]byte,
	ePubKey kbfscrypto.TLFEphemeralPublicKey) (MerkleLeaf, error) {
	eLeaf := kbfscrypto.MakeEncryptedMerkleLeaf(
		el.Version, el.EncryptedData, nonce)
	leafBytes, err := kbfscrypto.DecryptMerkleLeaf(privKey, ePubKey, eLeaf)
	if err != nil {
		return MerkleLeaf{}, err
	}
	// decode the leaf
	var leaf MerkleLeaf
	if err := codec.Decode(leafBytes, &leaf); err != nil {
		return MerkleLeaf{}, err
	}
	return leaf, nil
}
