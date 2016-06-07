// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func makeFakeBlockPointer(t *testing.T) BlockPointer {
	h, err := DefaultHash([]byte("fake buf"))
	require.NoError(t, err)
	return BlockPointer{
		BlockID{h},
		5,
		1,
		BlockContext{
			"fake creator",
			"fake writer",
			BlockRefNonce{0xb},
		},
	}
}

func makeFakeBlockInfo(t *testing.T) BlockInfo {
	return BlockInfo{
		makeFakeBlockPointer(t),
		150,
	}
}

type indirectDirPtrCurrent IndirectDirPtr

type indirectDirPtrFuture struct {
	indirectDirPtrCurrent
	extra
}

func (pf indirectDirPtrFuture) toCurrent() indirectDirPtrCurrent {
	return pf.indirectDirPtrCurrent
}

func (pf indirectDirPtrFuture) toCurrentStruct() currentStruct {
	return pf.toCurrent()
}

func makeFakeIndirectDirPtrFuture(t *testing.T) indirectDirPtrFuture {
	return indirectDirPtrFuture{
		indirectDirPtrCurrent{
			makeFakeBlockInfo(t),
			"offset",
			codec.UnknownFieldSetHandler{},
		},
		makeExtraOrBust("IndirectDirPtr", t),
	}
}

func TestIndirectDirPtrUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeIndirectDirPtrFuture(t))
}

type indirectFilePtrCurrent IndirectFilePtr

type indirectFilePtrFuture struct {
	indirectFilePtrCurrent
	extra
}

func (pf indirectFilePtrFuture) toCurrent() indirectFilePtrCurrent {
	return pf.indirectFilePtrCurrent
}

func (pf indirectFilePtrFuture) toCurrentStruct() currentStruct {
	return pf.toCurrent()
}

func makeFakeIndirectFilePtrFuture(t *testing.T) indirectFilePtrFuture {
	return indirectFilePtrFuture{
		indirectFilePtrCurrent{
			makeFakeBlockInfo(t),
			25,
			false,
			codec.UnknownFieldSetHandler{},
		},
		makeExtraOrBust("IndirectFilePtr", t),
	}
}

func TestIndirectFilePtrUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeIndirectFilePtrFuture(t))
}

type dirBlockCurrent DirBlock

type dirBlockFuture struct {
	dirBlockCurrent
	// Overrides dirBlockCurrent.Children.
	Children map[string]dirEntryFuture `codec:"c,omitempty"`
	// Overrides dirBlockCurrent.IPtrs.
	IPtrs []indirectDirPtrFuture `codec:"i,omitempty"`
	extra
}

func (dbf dirBlockFuture) toCurrent() dirBlockCurrent {
	db := dbf.dirBlockCurrent
	db.Children = make(map[string]DirEntry, len(dbf.Children))
	for k, v := range dbf.Children {
		db.Children[k] = DirEntry(v.toCurrent())
	}
	db.IPtrs = make([]IndirectDirPtr, len(dbf.IPtrs))
	for i, v := range dbf.IPtrs {
		db.IPtrs[i] = IndirectDirPtr(v.toCurrent())
	}
	return db
}

func (dbf dirBlockFuture) toCurrentStruct() currentStruct {
	return dbf.toCurrent()
}

func makeFakeDirBlockFuture(t *testing.T) dirBlockFuture {
	return dirBlockFuture{
		dirBlockCurrent{
			CommonBlock{
				true,
				codec.UnknownFieldSetHandler{},
				0,
			},
			nil,
			nil,
		},
		map[string]dirEntryFuture{
			"child1": makeFakeDirEntryFuture(t),
		},
		[]indirectDirPtrFuture{
			makeFakeIndirectDirPtrFuture(t),
		},
		makeExtraOrBust("DirBlock", t),
	}
}

func TestDirBlockUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeDirBlockFuture(t))
}

type fileBlockCurrent FileBlock

type fileBlockFuture struct {
	fileBlockCurrent
	// Overrides fileBlockCurrent.IPtrs.
	IPtrs []indirectFilePtrFuture `codec:"i,omitempty"`
	extra
}

func (fbf fileBlockFuture) toCurrent() fileBlockCurrent {
	fb := fbf.fileBlockCurrent
	fb.IPtrs = make([]IndirectFilePtr, len(fbf.IPtrs))
	for i, v := range fbf.IPtrs {
		fb.IPtrs[i] = IndirectFilePtr(v.toCurrent())
	}
	return fb
}

func (fbf fileBlockFuture) toCurrentStruct() currentStruct {
	return fbf.toCurrent()
}

func makeFakeFileBlockFuture(t *testing.T) fileBlockFuture {
	return fileBlockFuture{
		fileBlockCurrent{
			CommonBlock{
				false,
				codec.UnknownFieldSetHandler{},
				0,
			},
			[]byte{0xa, 0xb},
			nil,
		},
		[]indirectFilePtrFuture{
			makeFakeIndirectFilePtrFuture(t),
		},
		makeExtraOrBust("FileBlock", t),
	}
}

func TestFileBlockUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeFileBlockFuture(t))
}
