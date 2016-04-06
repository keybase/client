package libkbfs

import (
	"testing"

	"github.com/keybase/go-codec/codec"
)

type dirEntryCurrent DirEntry

type dirEntryFuture struct {
	dirEntryCurrent
	extra
}

func (cof dirEntryFuture) toCurrent() dirEntryCurrent {
	return cof.dirEntryCurrent
}

func (cof dirEntryFuture) toCurrentStruct() currentStruct {
	return cof.toCurrent()
}

func makeFakeDirEntryFuture(t *testing.T) dirEntryFuture {
	cof := dirEntryFuture{
		dirEntryCurrent{
			BlockInfo{
				makeFakeBlockPointer(t),
				150,
			},
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
