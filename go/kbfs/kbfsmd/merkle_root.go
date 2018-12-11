// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/protocol/keybase1"
	merkle "github.com/keybase/go-merkle-tree"
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
