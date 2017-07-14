// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
)

type dirEntryFuture struct {
	DirEntry
	kbfscodec.Extra
}

func (cof dirEntryFuture) toCurrent() DirEntry {
	return cof.DirEntry
}

func (cof dirEntryFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return cof.toCurrent()
}

func makeFakeDirEntry(t *testing.T, typ EntryType, size uint64) DirEntry {
	return DirEntry{
		makeFakeBlockInfo(t),
		EntryInfo{
			typ,
			size,
			"fake sym path",
			101,
			102,
			"",
		},
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeDirEntryFuture(t *testing.T) dirEntryFuture {
	cof := dirEntryFuture{
		makeFakeDirEntry(t, Dir, 100),
		kbfscodec.MakeExtraOrBust("dirEntry", t),
	}
	return cof
}

func TestDirEntryUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeDirEntryFuture(t))
}
