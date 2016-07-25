// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"testing"
)

func TestBsplitterEmptyCopyAll(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 10}
	fblock := NewFileBlock().(*FileBlock)
	data := []byte{1, 2, 3, 4, 5}

	if n := bsplit.CopyUntilSplit(fblock, false, data, 0); n != 5 {
		t.Errorf("Did not copy expected number of bytes: %d", n)
	} else if !bytes.Equal(fblock.Contents, data) {
		t.Errorf("Wrong file contents after copy: %v", fblock.Contents)
	}
}

func TestBsplitterNonemptyCopyAll(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 10}
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
	bsplit := &BlockSplitterSimple{10, 10}
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
	bsplit := &BlockSplitterSimple{10, 10}
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
	bsplit := &BlockSplitterSimple{10, 10}
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
	bsplit := &BlockSplitterSimple{5, 10}
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
	bsplit := &BlockSplitterSimple{3, 10}
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
	bsplit := &BlockSplitterSimple{10, 10}
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
	bsplit := &BlockSplitterSimple{10, 10}
	bc := &BlockChanges{}
	bc.sizeEstimate = 1
	if !bsplit.ShouldEmbedBlockChanges(bc) {
		t.Errorf("Not embedding a 1-byte block change")
	}
	bc.sizeEstimate = 10
	if !bsplit.ShouldEmbedBlockChanges(bc) {
		t.Errorf("Not embedding a 10-byte block change")
	}
}

func TestBsplitterShouldNotEmbed(t *testing.T) {
	bsplit := &BlockSplitterSimple{10, 10}
	bc := &BlockChanges{}
	bc.sizeEstimate = 11
	if bsplit.ShouldEmbedBlockChanges(bc) {
		t.Errorf("Not embedding a 1-byte block change")
	}
}

func TestBsplitterOverhead(t *testing.T) {
	codec := NewCodecMsgpack()
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
	crypto := MakeCryptoCommon(codec)
	paddedBlock, err := crypto.padBlock(encodedBlock)
	if err != nil {
		t.Fatalf("Padding block failed: %v", err)
	}
	// first 4 bytes of the padded block encodes the block size
	if g, e := int64(len(paddedBlock)), desiredBlockSize+4; g != e {
		t.Fatalf("Padded block size %d doesn't match desired block size %d",
			g, e)
	}
}
