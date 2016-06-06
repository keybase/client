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
//  2) Finished syncing, but the rest of thesync hasn't finished yet.
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

func newDirtyFile() *dirtyFile {
	return &dirtyFile{
		fileBlockStates: make(map[BlockPointer]dirtyBlockState),
	}
}

func (df *dirtyFile) blockNeedsCopy(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].copy == blockNeedsCopy
}

// dirtyBlock transitions a block to a dirty state, and returns
// whether or not the block needs to be put in the dirty cache
// (because it isn't yet), and whether or not the block is currently
// part of a sync in progress.
func (df *dirtyFile) dirtiedBlock(ptr BlockPointer) (
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

func (df *dirtyFile) blockSyncingAndDirty(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	state := df.fileBlockStates[ptr]
	return state.copy == blockAlreadyCopied && state.sync == blockSyncing
}

func (df *dirtyFile) syncingBlock(ptr BlockPointer) error {
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

func (df *dirtyFile) errorOnSync() {
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

func (df *dirtyFile) syncedBlockLocked(ptr BlockPointer) error {
	state := df.fileBlockStates[ptr]
	if state.copy == blockAlreadyCopied && state.sync == blockNotSyncing {
		// We've likely already had an errorOnSync call; ignore
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
		if state.sync == blockSyncing {
			err := df.syncedBlockLocked(ptr)
			if err != nil {
				panic(fmt.Sprintf("Unexpected error: %v", err))
			}
		}
	}
}
