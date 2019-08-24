// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

const testFakeBlockSize = uint32(150)

func makeFakeFileBlock(t *testing.T, doHash bool) *data.FileBlock {
	buf := make([]byte, 16)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	block := &data.FileBlock{
		CommonBlock: data.NewCommonBlockForTesting(false, testFakeBlockSize),
		Contents:    buf,
	}
	if doHash {
		_ = block.GetHash()
	}
	return block
}

func makeFakeFileBlockWithIPtrs(iptrs []data.IndirectFilePtr) *data.FileBlock {
	return &data.FileBlock{
		CommonBlock: data.NewCommonBlockForTesting(true, testFakeBlockSize),
		IPtrs:       iptrs,
	}
}

func makeFakeBlockContext(t *testing.T) kbfsblock.Context {
	return kbfsblock.MakeContext(
		"fake creator",
		"fake writer",
		kbfsblock.RefNonce{0xb},
		keybase1.BlockType_DATA,
	)
}

func makeFakeBlockPointer(t *testing.T) data.BlockPointer {
	return data.BlockPointer{
		ID:         kbfsblock.FakeID(1),
		KeyGen:     5,
		DataVer:    1,
		DirectType: data.DirectBlock,
		Context:    makeFakeBlockContext(t),
	}
}

func makeFakeBlockInfo(t *testing.T) data.BlockInfo {
	return data.BlockInfo{
		BlockPointer: makeFakeBlockPointer(t),
		EncodedSize:  150,
	}
}
