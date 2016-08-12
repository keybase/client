// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

type journalBlockCache struct {
	jServer *JournalServer
	BlockCache
}

var _ BlockCache = journalBlockCache{}

// CheckForKnownPtr implements BlockCache.
func (j journalBlockCache) CheckForKnownPtr(
	tlfID TlfID, block *FileBlock) (BlockPointer, error) {
	_, ok := j.jServer.getBundle(tlfID)
	if !ok {
		return j.BlockCache.CheckForKnownPtr(tlfID, block)
	}

	// Temporarily disable de-duping for the journal server until
	// KBFS-1149 is fixed. (See also
	// journalBlockServer.AddReference.)
	return BlockPointer{}, nil
}
