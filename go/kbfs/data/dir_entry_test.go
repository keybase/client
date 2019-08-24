// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/go-codec/codec"
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
			nil,
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
	kbfscodec.TestStructUnknownFieldsMsgpack(t, makeFakeDirEntryFuture(t))
}
