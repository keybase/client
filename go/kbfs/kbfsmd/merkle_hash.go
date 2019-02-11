// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"encoding"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfshash"
)

// MerkleHash is the hash of a RootMetadataSigned block.
type MerkleHash struct {
	h kbfshash.Hash
}

// MakeMerkleHash hashes the given signed RootMetadata object.
func MakeMerkleHash(codec kbfscodec.Codec, md *RootMetadataSigned) (MerkleHash, error) {
	buf, err := codec.Encode(md)
	if err != nil {
		return MerkleHash{}, err
	}
	h, err := kbfshash.DefaultHash(buf)
	if err != nil {
		return MerkleHash{}, err
	}
	return MerkleHash{h}, nil
}

var _ encoding.BinaryMarshaler = MerkleHash{}
var _ encoding.BinaryUnmarshaler = (*MerkleHash)(nil)

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
