// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
)

func TestBsplitterEmptyCopyAll(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	data := []byte{1, 2, 3, 4, 5}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 0); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, data) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterNonemptyCopyAll(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9}
	data := []byte{1, 2, 3, 4, 5}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 0); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, data) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterAppendAll(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9}
	data := []byte{1, 2, 3, 4, 5}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 2); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, append([]byte{10, 9}, data...)) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterAppendExact(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9, 8, 7, 6}
	data := []byte{1, 2, 3, 4, 5}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 5); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents,
		append([]byte{10, 9, 8, 7, 6}, data...)) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterSplitOne(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9, 8, 7, 6}
	data := []byte{1, 2, 3, 4, 5, 6}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 5); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents,
		[]byte{10, 9, 8, 7, 6, 1, 2, 3, 4, 5}) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterOverwriteMaxSizeBlock(t *testing.T) {
	bsplit := &BlockSplitterSimple{5, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9, 8, 7, 6}
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 0); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, []byte{1, 2, 3, 4, 5}) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterBlockTooBig(t *testing.T) {
	bsplit := &BlockSplitterSimple{3, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9, 8, 7, 6}
	data := []byte{1, 2, 3, 4, 5, 6}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 5); n != 0 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, []byte{10, 9, 8, 7, 6}) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterOffTooBig(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	fblock := NewFileBlock().(*FileBlock)
	fblock.Contents = []byte{10, 9, 8, 7, 6}
	data := []byte{1, 2, 3, 4, 5, 6}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 15); n != 0 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents,
		[]byte{10, 9, 8, 7, 6, 0, 0, 0, 0, 0}) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterShouldEmbed(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	if !bsplit.ShouldEmbedData(1) {
		t.Errorf("Not embedding a 1-byte block change")
	}
	if !bsplit.ShouldEmbedData(10) {
		t.Errorf("Not embedding a 10-byte block change")
	}
}

func TestBsplitterShouldNotEmbed(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 0}
	if bsplit.ShouldEmbedData(11) {
		t.Errorf("Not embedding a 1-byte block change")
	}
}

func TestBsplitterOverhead(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	desiredBlockSize := int64(64 * 1024)
	bsplit, err := NewBlockSplitterSimple(desiredBlockSize, 8*1024, codec)
	if err != nil {
		t.Fatalf("Got error making block splitter with overhead: %v", err)
	}

	// Test that an encoded, padded block matches this desired block size
	block := NewFileBlock().(*FileBlock)
	block.Contents = make([]byte, bsplit.maxSize)
	for i := range block.Contents {
		block.Contents[i] = byte(i)
	}
	encodedBlock, err := codec.Encode(block)
	if err != nil {
		t.Fatalf("Encoding block failed: %v", err)
	}
	paddedBlock, err := kbfscrypto.PadBlock(encodedBlock)
	if err != nil {
		t.Fatalf("Padding block failed: %v", err)
	}
	// first 4 bytes of the padded block encodes the block size
	if g, e := int64(len(paddedBlock)), desiredBlockSize+4; g != e {
		t.Fatalf("Padded block size %d doesn't match desired block size %d",
			g, e)
	}
}

func TestBsplitterSplitDir(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 5, 10, 2}
	dblock := NewDirBlock().(*DirBlock)
	dblock.Children["a"] = DirEntry{}
	dblock.Children["b"] = DirEntry{}
	dblock.Children["c"] = DirEntry{}
	dblock.Children["d"] = DirEntry{}
	dblock.Children["e"] = DirEntry{}
	dblock.Children["f"] = DirEntry{}

	t.Log("Split an even block")
	blocks, newOffset := bsplit.SplitDirIfNeeded(dblock)
	require.Len(t, blocks, 2)
	require.Equal(t, StringOffset("d"), *newOffset)
	require.Len(t, blocks[0].Children, 3)
	require.Contains(t, blocks[0].Children, "a")
	require.Contains(t, blocks[0].Children, "b")
	require.Contains(t, blocks[0].Children, "c")
	require.Len(t, blocks[1].Children, 3)
	require.Contains(t, blocks[1].Children, "d")
	require.Contains(t, blocks[1].Children, "e")
	require.Contains(t, blocks[1].Children, "f")

	t.Log("Split odd blocks")
	smallerBlocks, newOffset := bsplit.SplitDirIfNeeded(blocks[0])
	require.Len(t, smallerBlocks, 2)
	require.Equal(t, StringOffset("b"), *newOffset)
	require.Len(t, smallerBlocks[0].Children, 1)
	require.Contains(t, smallerBlocks[0].Children, "a")
	require.Len(t, smallerBlocks[1].Children, 2)
	require.Contains(t, smallerBlocks[1].Children, "b")
	require.Contains(t, smallerBlocks[1].Children, "c")
	smallerBlocks, newOffset = bsplit.SplitDirIfNeeded(blocks[1])
	require.Len(t, smallerBlocks, 2)
	require.Equal(t, StringOffset("e"), *newOffset)
	require.Len(t, smallerBlocks[0].Children, 1)
	require.Contains(t, smallerBlocks[0].Children, "d")
	require.Len(t, smallerBlocks[1].Children, 2)
	require.Contains(t, smallerBlocks[1].Children, "e")
	require.Contains(t, smallerBlocks[1].Children, "f")

	t.Log("Don't split small blocks")
	noSplits, newOffset := bsplit.SplitDirIfNeeded(smallerBlocks[0])
	require.Len(t, noSplits, 1)
	require.Nil(t, newOffset)
	require.Equal(t, smallerBlocks[0], noSplits[0])
	noSplits, newOffset = bsplit.SplitDirIfNeeded(smallerBlocks[1])
	require.Len(t, noSplits, 1)
	require.Nil(t, newOffset)
	require.Equal(t, smallerBlocks[1], noSplits[0])
}
