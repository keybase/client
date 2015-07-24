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
