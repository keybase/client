// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
)

func makeFakeBlockContext(t *testing.T) kbfsblock.Context {
	return kbfsblock.MakeContext(
		"fake creator",
		"fake writer",
		kbfsblock.RefNonce{0xb},
	)
}

func makeFakeBlockPointer(t *testing.T) BlockPointer {
	return BlockPointer{
		kbfsblock.FakeID(1),
		5,
		1,
		makeFakeBlockContext(t),
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
	kbfscodec.Extra
}

func (pf indirectDirPtrFuture) toCurrent() indirectDirPtrCurrent {
	return pf.indirectDirPtrCurrent
}

func (pf indirectDirPtrFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return pf.toCurrent()
}

func makeFakeIndirectDirPtrFuture(t *testing.T) indirectDirPtrFuture {
	return indirectDirPtrFuture{
		indirectDirPtrCurrent{
			makeFakeBlockInfo(t),
			"offset",
			codec.UnknownFieldSetHandler{},
		},
		kbfscodec.MakeExtraOrBust("IndirectDirPtr", t),
	}
}

func TestIndirectDirPtrUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeIndirectDirPtrFuture(t))
}

type indirectFilePtrCurrent IndirectFilePtr

type indirectFilePtrFuture struct {
	indirectFilePtrCurrent
	kbfscodec.Extra
}

func (pf indirectFilePtrFuture) toCurrent() indirectFilePtrCurrent {
	return pf.indirectFilePtrCurrent
}

func (pf indirectFilePtrFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
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
		kbfscodec.MakeExtraOrBust("IndirectFilePtr", t),
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
	kbfscodec.Extra
}

func (dbf *dirBlockFuture) NewEmpty() Block {
	return &dirBlockFuture{}
}

func (dbf *dirBlockFuture) Set(other Block, codec kbfscodec.Codec) {
	otherDbf := other.(*dirBlockFuture)
	err := kbfscodec.Update(codec, dbf, otherDbf)
	if err != nil {
		panic("Unable to dirBlockFuture.Set")
	}
	if dbf.Children == nil {
		dbf.Children = make(map[string]dirEntryFuture, len(otherDbf.Children))
	}
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

func (dbf dirBlockFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
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
		kbfscodec.MakeExtraOrBust("DirBlock", t),
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
	kbfscodec.Extra
}

func (fbf *fileBlockFuture) NewEmpty() Block {
	return &fileBlockFuture{}
}

func (fbf *fileBlockFuture) Set(other Block, codec kbfscodec.Codec) {
	otherFbf := other.(*fileBlockFuture)
	err := kbfscodec.Update(codec, fbf, otherFbf)
	if err != nil {
		panic("Unable to fileBlockFuture.Set")
	}
}

func (fbf fileBlockFuture) toCurrent() fileBlockCurrent {
	fb := fbf.fileBlockCurrent
	fb.IPtrs = make([]IndirectFilePtr, len(fbf.IPtrs))
	for i, v := range fbf.IPtrs {
		fb.IPtrs[i] = IndirectFilePtr(v.toCurrent())
	}
	return fb
}

func (fbf fileBlockFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
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
			nil,
		},
		[]indirectFilePtrFuture{
			makeFakeIndirectFilePtrFuture(t),
		},
		kbfscodec.MakeExtraOrBust("FileBlock", t),
	}
}

func TestFileBlockUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeFileBlockFuture(t))
}
