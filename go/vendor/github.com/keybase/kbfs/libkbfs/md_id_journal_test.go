// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfsmd"
)

type mdIDJournalEntryFuture struct {
	mdIDJournalEntry
	kbfscodec.Extra
}

func (ef mdIDJournalEntryFuture) toCurrent() mdIDJournalEntry {
	return ef.mdIDJournalEntry
}

func (ef mdIDJournalEntryFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return ef.toCurrent()
}

func makeFakeMDIDJournalEntryFuture(t *testing.T) mdIDJournalEntryFuture {
	ef := mdIDJournalEntryFuture{
		mdIDJournalEntry{
			kbfsmd.FakeID(1),
			false, false, false,
			codec.UnknownFieldSetHandler{},
		},
		kbfscodec.MakeExtraOrBust("mdIDJournalEntry", t),
	}
	return ef
}

func TestMDIDJournalEntryUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeMDIDJournalEntryFuture(t))
}
