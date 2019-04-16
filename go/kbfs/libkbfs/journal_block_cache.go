// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/tlf"
)

type journalBlockCache struct {
	jManager *JournalManager
	data.BlockCache
}

var _ data.BlockCache = journalBlockCache{}

// CheckForKnownPtr implements BlockCache.
func (j journalBlockCache) CheckForKnownPtr(
	tlfID tlf.ID, block *data.FileBlock) (data.BlockPointer, error) {
	_, ok := j.jManager.getTLFJournal(tlfID, nil)
	if !ok {
		return j.BlockCache.CheckForKnownPtr(tlfID, block)
	}

	// Temporarily disable de-duping for the journal server until
	// KBFS-1149 is fixed. (See also
	// journalBlockServer.AddReference.)
	return data.BlockPointer{}, nil
}
