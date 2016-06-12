// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
)

// dirtyBlockSyncState represents that state of a block with respect to
// whether it's currently being synced.  There can be three states:
//  0) Not being synced
//  1) Currently being synced to the server.
//  2) Finished syncing, but the rest of the sync hasn't finished yet.
type dirtyBlockSyncState int

const (
	blockNotSyncing dirtyBlockSyncState = iota
	blockSyncing
	blockSynced
)

// dirtyBlockCopyState represents that state of a block with respect
// to whether it needs to be copied if it is modified by the caller.
type dirtyBlockCopyState int

const (
	blockNeedsCopy dirtyBlockCopyState = iota
	blockAlreadyCopied
)

type dirtyBlockState struct {
	sync dirtyBlockSyncState
	copy dirtyBlockCopyState
}

// dirtyFile represents a particular file that's been written to, but
// has not yet completed syncing its dirty blocks to the server.
type dirtyFile struct {
	path path

	// Protects access to fileBlockStates.  Most, but not all,
	// accesses to dirtyFile is already protected by
	// folderBlockOps.blockLock, so this lock should always be taken
	// just in case.
	lock sync.Mutex
	// Which blocks are currently being synced and still need copying,
	// so that writes and truncates can do copy-on-write to avoid
	// messing up the ongoing sync.  If it is blockSyncing and
	// blockNeedsCopy, then any write to the block should result in a
	// deep copy and those writes should be deferred; if it is
	// blockSyncing and blockAlreadyCopied, then just defer the
	// writes.
	fileBlockStates map[BlockPointer]dirtyBlockState
}

func newDirtyFile(file path) *dirtyFile {
	return &dirtyFile{
		path:            file,
		fileBlockStates: make(map[BlockPointer]dirtyBlockState),
	}
}

func (df *dirtyFile) blockNeedsCopy(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].copy == blockNeedsCopy
}

// setBlockDirty transitions a block to a dirty state, and returns
// whether or not the block needs to be put in the dirty cache
// (because it isn't yet), and whether or not the block is currently
// part of a sync in progress.
func (df *dirtyFile) setBlockDirty(ptr BlockPointer) (
	needsCaching bool, isSyncing bool) {
	df.lock.Lock()
	defer df.lock.Unlock()

	state := df.fileBlockStates[ptr]
	needsCaching = state.copy == blockNeedsCopy
	state.copy = blockAlreadyCopied
	isSyncing = state.sync != blockNotSyncing
	df.fileBlockStates[ptr] = state
	return needsCaching, isSyncing
}

func (df *dirtyFile) setBlockNotDirty(ptr BlockPointer) (
	needsCaching bool, isSyncing bool) {
	df.lock.Lock()
	defer df.lock.Unlock()
	state := df.fileBlockStates[ptr]
	state.copy = blockNeedsCopy
	df.fileBlockStates[ptr] = state
	return
}

func (df *dirtyFile) isBlockSyncing(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].sync == blockSyncing
}

func (df *dirtyFile) isBlockDirty(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].copy == blockAlreadyCopied
}

func (df *dirtyFile) setBlockSyncing(ptr BlockPointer) error {
	df.lock.Lock()
	defer df.lock.Unlock()
	state := df.fileBlockStates[ptr]
	if state.copy == blockNeedsCopy {
		return fmt.Errorf("Trying to sync a block that isn't dirty: %v", ptr)
	}
	state.copy = blockNeedsCopy
	state.sync = blockSyncing
	df.fileBlockStates[ptr] = state
	return nil
}

func (df *dirtyFile) resetSyncingBlocksToDirty() {
	df.lock.Lock()
	defer df.lock.Unlock()
	// Reset all syncing blocks to just be dirty again
	for ptr, state := range df.fileBlockStates {
		if state.sync != blockNotSyncing {
			state.copy = blockAlreadyCopied
			state.sync = blockNotSyncing
			df.fileBlockStates[ptr] = state
		}
	}
}

func (df *dirtyFile) setBlockSyncedLocked(ptr BlockPointer) error {
	state := df.fileBlockStates[ptr]
	if state.copy == blockAlreadyCopied && state.sync == blockNotSyncing {
		// We've likely already had an resetSyncingBlocksToDirty call; ignore.
		return nil
	}

	if state.sync != blockSyncing {
		return fmt.Errorf("Trying to finish a block sync that wasn't in "+
			"progress: %v (%d)", ptr, df.fileBlockStates[ptr])
	}
	state.sync = blockSynced
	df.fileBlockStates[ptr] = state
	// TODO: Eventually we'll need to free up space in the buffer
	// taken up by these sync'd blocks, so new writes can proceed.
	return nil
}

func (df *dirtyFile) setBlockSynced(ptr BlockPointer) error {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.setBlockSyncedLocked(ptr)
}

func (df *dirtyFile) finishSync() error {
	// Mark any remaining blocks as finished syncing.  For now, only
	// the top-level indirect block needs this because they are added
	// to the blockPutState by folderBranchOps, not folderBlockOps.
	df.lock.Lock()
	defer df.lock.Unlock()

	// Reset all syncing blocks to just be dirty again (there should
	// only be one, equal to the original top block).
	found := false
	for ptr, state := range df.fileBlockStates {
		if state.sync == blockSyncing {
			if found {
				return fmt.Errorf("Unexpected syncing block %v", ptr)
			}
			if ptr != df.path.tailPointer() {
				return fmt.Errorf("Unexoected syncing block %v; expected %v",
					ptr, df.path.tailPointer())
			}
			found = true
			err := df.setBlockSyncedLocked(ptr)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
