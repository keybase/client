// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"context"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	merkle "github.com/keybase/go-merkle-tree"
	"github.com/pkg/errors"
)

// merkleChecker implements a storage engine that can be used to
// verify a chain of merkle nodes returned from the server, to
// validate a given MD leaf.
type merkleChecker struct {
	root     *kbfsmd.MerkleRoot
	nodes    [][]byte
	nextNode int
}

var _ merkle.StorageEngine = (*merkleChecker)(nil)

func (mc *merkleChecker) StoreNode(
	_ context.Context, _ merkle.Hash, _ []byte) error {
	return errors.New("merkleChecker can't store nodes")
}

func (mc *merkleChecker) CommitRoot(
	_ context.Context, _ merkle.Hash, _ merkle.Hash, _ merkle.TxInfo) error {
	return errors.New("merkleChecker can't commit roots")
}

func (mc *merkleChecker) LookupNode(
	_ context.Context, h merkle.Hash) ([]byte, error) {
	// Assume the hash refers to the next node in the list; if not,
	// the tree will fail when verifying.
	if mc.nextNode >= len(mc.nodes) {
		return nil, errors.Errorf(
			"Can't lookup node %d when there are only %d nodes",
			mc.nextNode, len(mc.nodes))
	}
	n := mc.nodes[mc.nextNode]
	mc.nextNode++
	return n, nil
}

func (mc *merkleChecker) LookupRoot(_ context.Context) (
	h merkle.Hash, err error) {
	return mc.root.Hash, nil
}

func verifyMerkleNodes(
	ctx context.Context, kbfsRoot *kbfsmd.MerkleRoot, nodes [][]byte,
	tlfID tlf.ID) error {
	// Verify the merkle nodes by pretending to look up the nodes
	// using a merkle.Tree, which verifies all the nodes along the
	// path of the lookup.
	mc := &merkleChecker{kbfsRoot, nodes, 0}
	config := merkle.NewConfig(
		merkle.SHA512Hasher{}, 256, 512, kbfsmd.MerkleLeaf{})
	tree := merkle.NewTree(mc, config)
	// If any of the nodes returned by the server fail to match their
	// expected hashes, `Find` will return an error.
	foundLeaf, rootHash, err := tree.Find(ctx, merkle.Hash(tlfID.Bytes()))
	if err != nil {
		return err
	}
	if !rootHash.Eq(kbfsRoot.Hash) {
		return errors.Errorf("Root hashes don't match: found=%v, rootHash=%v",
			rootHash, kbfsRoot.Hash)
	}
	// If the checker returned all the nodes except the last one
	// (which is the encoded leaf, and not directly walked by the
	// `Find` call above), we know they all verified and we reached
	// the expected leaf.
	if mc.nextNode != len(nodes)-1 {
		return errors.Errorf("We checked %d nodes instead of %d",
			mc.nextNode, len(nodes))
	}

	leafBytes, ok := foundLeaf.(*[]byte)
	if !ok {
		return errors.Errorf(
			"Found merkle leaf isn't a byte slice pointer: %T", foundLeaf)
	}

	if !bytes.Equal(*leafBytes, nodes[len(nodes)-1]) {
		return errors.Errorf("Expected leaf didn't match found leaf: expected=%x, found=%x", nodes[len(nodes)-1], *leafBytes)
	}

	return nil
}
