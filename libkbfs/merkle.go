// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding"

	"github.com/keybase/client/go/protocol/keybase1"
	merkle "github.com/keybase/go-merkle-tree"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/kbfsmd"
)

// MerkleRootVersion is the current Merkle root version.
const MerkleRootVersion = 1

// MerkleRoot represents a signed Merkle tree root.
type MerkleRoot struct {
	Version   int                               `codec:"v"`
	TreeID    keybase1.MerkleTreeID             `codec:"t"`
	SeqNo     int64                             `codec:"sn"`
	Timestamp int64                             `codec:"ts"`
	Hash      merkle.Hash                       `codec:"h"`
	PrevRoot  merkle.Hash                       `codec:"pr"`
	EPubKey   *kbfscrypto.TLFEphemeralPublicKey `codec:"epk,omitempty"` // these two are only necessary with encrypted leaves.
	Nonce     *[24]byte                         `codec:"non,omitempty"` // the public tree leaves are in the clear.
}

// MerkleLeaf is the value of a Merkle leaf node.
type MerkleLeaf struct {
	_struct   bool `codec:",toarray"`
	Revision  kbfsmd.Revision
	Hash      MerkleHash // hash of the signed metadata object
	Timestamp int64
}

var _ merkle.ValueConstructor = (*MerkleLeaf)(nil)

// Construct implements the go-merkle-tree.ValueConstructor interface.
func (l MerkleLeaf) Construct() interface{} {
	// In the Merkle tree leaves are simply byte slices.
	return []byte{}
}

// MerkleHash is the hash of a RootMetadataSigned block.
type MerkleHash struct {
	h kbfshash.Hash
}

var _ encoding.BinaryMarshaler = MerkleHash{}
var _ encoding.BinaryUnmarshaler = (*MerkleHash)(nil)

// MerkleHashFromBytes creates a new MerkleHash from the given bytes. If the
// returned error is nil, the returned MerkleHash is valid.
func MerkleHashFromBytes(data []byte) (MerkleHash, error) {
	h, err := kbfshash.HashFromBytes(data)
	if err != nil {
		return MerkleHash{}, err
	}
	return MerkleHash{h}, nil
}

// Bytes returns the bytes of the MerkleHash.
func (h MerkleHash) Bytes() []byte {
	return h.h.Bytes()
}

// String returns the string form of the MerkleHash.
func (h MerkleHash) String() string {
	return h.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// MerkleHash. Returns an error if the MerkleHash is invalid and not the
// zero MerkleHash.
func (h MerkleHash) MarshalBinary() (data []byte, err error) {
	return h.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for MerkleHash. Returns an error if the given byte array is non-empty and
// the MerkleHash is invalid.
func (h *MerkleHash) UnmarshalBinary(data []byte) error {
	return h.h.UnmarshalBinary(data)
}
