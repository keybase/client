// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	merkle "github.com/keybase/go-merkle-tree"
	"github.com/stretchr/testify/require"
)

func testValueConstructor(t *testing.T, vc merkle.ValueConstructor) {
	c := kbfscodec.NewMsgpack()

	// Mimic the logic in merkle.Tree.findTyped.
	data := []byte("hello world")
	buf, err := c.Encode(data)
	require.NoError(t, err)

	obj := vc.Construct()
	err = c.Decode(buf, &obj)
	require.NoError(t, err)

	require.Equal(t, &data, obj)
}

func TestConstructMerkleLeaf(t *testing.T) {
	testValueConstructor(t, MerkleLeaf{})
}

func TestConstructEncryptedMerkleLeaf(t *testing.T) {
	testValueConstructor(t, EncryptedMerkleLeaf{})
}
