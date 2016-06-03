// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
)

// syncBlockState represents that state of a block with respect to
// whether it's dirty or currently being synced.  There can be six states:
//  1) Not dirty or being synced
//  2) Dirty and awaiting a sync
//  3) Being synced and not yet re-dirtied: any write needs to
//     make a copy of the block before dirtying it.  Also, all writes must be
//     deferred.
//  4) Being synced and already re-dirtied: no copies are needed, but all
//     writes must still be deferred.
//  5) Finished syncing, and not yet re-dirtied, but the rest of the
//     sync hasn't finished yet.
//  5) Finished syncing, and already re-dirtied, but the rest of the
//     sync hasn't finished yet.
type syncBlockState int

const (
	blockNotDirty syncBlockState = iota
	blockDirty
	blockSyncingNotDirty
	blockSyncingAndDirty
	blockSyncedAndDirty
	blockSyncedNotDirty
)

// dirtyFile represents a particular file that's been written to, but
// has not yet completed syncing its dirty blocks to the server.
type dirtyFile struct {
	lock sync.Mutex
	// Which blocks are currently being synced, so that writes and
	// truncates can do copy-on-write to avoid messing up the ongoing
	// sync.  If it is blockSyncingNotDirty, then any write to the
	// block should result in a deep copy and those writes should be
	// deferred; if it is blockSyncingAndDirty, then just defer the
	// writes.
	fileBlockStates map[BlockPointer]syncBlockState
}

func newDirtyFile() *dirtyFile {
	return &dirtyFile{
		fileBlockStates: make(map[BlockPointer]syncBlockState),
	}
}

func (df *dirtyFile) blockNeedsCopy(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr] == blockSyncingNotDirty
}

// dirtyBlock transitions a block to a dirty state, and returns
// whether or not the block needs to be put in the dirty cache
// (because it isn't yet), and whether or not the block is currently
// part of a sync in progress.
func (df *dirtyFile) dirtiedBlock(ptr BlockPointer) (
	needsCaching bool, isSyncing bool) {
	df.lock.Lock()
	defer df.lock.Unlock()

	switch df.fileBlockStates[ptr] {
	case blockNotDirty:
		// A clean block became dirty
		df.fileBlockStates[ptr] = blockDirty
		return true, false
	case blockDirty:
		// Nothing to do, already dirty.
		return false, false
	case blockSyncingNotDirty:
		// Future writes can use this same block.
		df.fileBlockStates[ptr] = blockSyncingAndDirty
		return true, true
	case blockSyncingAndDirty:
		return false, true
	case blockSyncedNotDirty:
		// Future writes can use this same block.
		df.fileBlockStates[ptr] = blockSyncedAndDirty
		return true, true
	case blockSyncedAndDirty:
		return false, true
	default:
		panic(fmt.Sprintf("Unknown dirty block state: %v",
			df.fileBlockStates[ptr]))
	}
}

func (df *dirtyFile) blockSyncingAndDirty(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr] == blockSyncingAndDirty
}

func (df *dirtyFile) syncingBlock(ptr BlockPointer) error {
	df.lock.Lock()
	defer df.lock.Unlock()
	if df.fileBlockStates[ptr] == blockNotDirty {
		return fmt.Errorf("Trying to sync a block that isn't dirty: %v", ptr)
	}
	df.fileBlockStates[ptr] = blockSyncingNotDirty
	return nil
}

func (df *dirtyFile) errorOnSync() {
	df.lock.Lock()
	defer df.lock.Unlock()
	// Reset all syncing blocks to just be dirty again
	for ptr, state := range df.fileBlockStates {
		if state > blockDirty {
			df.fileBlockStates[ptr] = blockDirty
		}
	}
}

func (df *dirtyFile) syncedBlockLocked(ptr BlockPointer) error {
	switch df.fileBlockStates[ptr] {
	case blockDirty:
		// We've likely already had an errorOnSync call; ignore
	case blockSyncingNotDirty:
		df.fileBlockStates[ptr] = blockSyncedNotDirty
	case blockSyncingAndDirty:
		df.fileBlockStates[ptr] = blockSyncedAndDirty
	default:
		return fmt.Errorf("Trying to finish a block sync that wasn't in "+
			"progress: %v (%d)", ptr, df.fileBlockStates[ptr])
	}
	// TODO: Eventually we'll need to free up space in the buffer
	// taken up by these sync'd blocks, so new writes can proceed.
	return nil
}

func (df *dirtyFile) syncedBlock(ptr BlockPointer) error {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.syncedBlockLocked(ptr)
}

func (df *dirtyFile) syncFinished() {
	// Mark any remaining blocks as finished syncing.  For example,
	// top-level indirect blocks needs this because they are added to
	// the blockPutState by folderBranchOps, not folderBlockOps.
	df.lock.Lock()
	defer df.lock.Unlock()
	// Reset all syncing blocks to just be dirty again
	for ptr, state := range df.fileBlockStates {
		if state == blockSyncingNotDirty || state == blockSyncingAndDirty {
			err := df.syncedBlockLocked(ptr)
			if err != nil {
				panic(fmt.Sprintf("Unexpected error: %v", err))
			}
		}
	}
}
