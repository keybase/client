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
	extra
}

func (cof dirEntryFuture) toCurrent() DirEntry {
	return cof.DirEntry
}

func (cof dirEntryFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return cof.toCurrent()
}

func makeFakeDirEntryFuture(t *testing.T) dirEntryFuture {
	cof := dirEntryFuture{
		DirEntry{
			makeFakeBlockInfo(t),
			EntryInfo{
				Dir,
				100,
				"fake sym path",
				101,
				102,
			},
			codec.UnknownFieldSetHandler{},
		},
		makeExtraOrBust("dirEntry", t),
	}
	return cof
}

func TestDirEntryUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeDirEntryFuture(t))
}
