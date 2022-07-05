// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"sync"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

func makeFakeBlockContext(t *testing.T) kbfsblock.Context {
	return kbfsblock.MakeContext(
		"fake creator",
		"fake writer",
		kbfsblock.RefNonce{0xb},
		keybase1.BlockType_DATA,
	)
}

func makeFakeBlockPointer(t *testing.T) BlockPointer {
	return BlockPointer{
		kbfsblock.FakeID(1),
		5,
		1,
		DirectBlock,
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
	kbfscodec.TestStructUnknownFieldsMsgpack(t, makeFakeIndirectDirPtrFuture(t))
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
	kbfscodec.TestStructUnknownFieldsMsgpack(
		t, makeFakeIndirectFilePtrFuture(t))
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

func (dbf *dirBlockFuture) Set(other Block) {
	otherDbf := other.(*dirBlockFuture)
	childrenCopy := make(map[string]dirEntryFuture, len(otherDbf.Children))
	for k, v := range otherDbf.Children {
		childrenCopy[k] = v
	}
	ptrsCopy := make([]indirectDirPtrFuture, len(otherDbf.IPtrs))
	copy(ptrsCopy, otherDbf.IPtrs)
	dbf.Children = childrenCopy
	dbf.IPtrs = ptrsCopy
	dbf.CommonBlock.IsInd = otherDbf.IsInd
	dbf.CommonBlock.UnknownFieldSetHandler = otherDbf.UnknownFieldSetHandler
	dbf.CommonBlock.SetEncodedSize(otherDbf.GetEncodedSize())
}

func (dbf *dirBlockFuture) toCurrent() *dirBlockCurrent {
	db := &dirBlockCurrent{
		CommonBlock: dbf.CommonBlock.DeepCopy(),
	}
	db.Children = make(map[string]DirEntry, len(dbf.Children))
	for k, v := range dbf.Children {
		db.Children[k] = v.toCurrent()
	}
	db.IPtrs = make([]IndirectDirPtr, len(dbf.IPtrs))
	for i, v := range dbf.IPtrs {
		db.IPtrs[i] = IndirectDirPtr(v.toCurrent())
	}
	return db
}

func (dbf *dirBlockFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return dbf.toCurrent()
}

func makeFakeDirBlockFuture(t *testing.T) *dirBlockFuture {
	return &dirBlockFuture{
		dirBlockCurrent{
			CommonBlock{
				true,
				codec.UnknownFieldSetHandler{},
				sync.RWMutex{},
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
	kbfscodec.TestStructUnknownFieldsMsgpack(t, makeFakeDirBlockFuture(t))
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

func (fbf *fileBlockFuture) Set(other Block) {
	otherFbf := other.(*fileBlockFuture)
	fbf.Contents = make([]byte, len(otherFbf.Contents))
	copy(fbf.Contents, otherFbf.Contents)
	fbf.IPtrs = make([]indirectFilePtrFuture, len(otherFbf.IPtrs))
	copy(fbf.IPtrs, otherFbf.IPtrs)
	fbf.CommonBlock.IsInd = otherFbf.IsInd
	fbf.CommonBlock.UnknownFieldSetHandler = otherFbf.UnknownFieldSetHandler
	fbf.CommonBlock.SetEncodedSize(otherFbf.GetEncodedSize())
}

func (fbf *fileBlockFuture) toCurrent() *fileBlockCurrent {
	fb := &fileBlockCurrent{
		CommonBlock: fbf.CommonBlock.DeepCopy(),
		hash:        fbf.hash,
	}
	fb.IPtrs = make([]IndirectFilePtr, len(fbf.IPtrs))
	for i, v := range fbf.IPtrs {
		fb.IPtrs[i] = IndirectFilePtr(v.toCurrent())
	}
	if fbf.Contents != nil {
		fb.Contents = make([]byte, len(fbf.Contents))
		copy(fb.Contents, fbf.Contents)
	}
	return fb
}

func (fbf *fileBlockFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return fbf.toCurrent()
}

func makeFakeFileBlockFuture(t *testing.T) *fileBlockFuture {
	return &fileBlockFuture{
		fileBlockCurrent{
			CommonBlock{
				false,
				codec.UnknownFieldSetHandler{},
				sync.RWMutex{},
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
	kbfscodec.TestStructUnknownFieldsMsgpack(t, makeFakeFileBlockFuture(t))
}
