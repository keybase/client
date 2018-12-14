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
	sync     dirtyBlockSyncState
	copy     dirtyBlockCopyState
	syncSize int64
	// An "orphaned" block is one that is now referred to in an
	// indirect file block under its new, permanent block ID.  Once a
	// block is orphaned, it is no longer re-dirtiable.
	orphaned bool
}

// dirtyFile represents a particular file that's been written to, but
// has not yet completed syncing its dirty blocks to the server.
type dirtyFile struct {
	path        path
	dirtyBcache DirtyBlockCache

	// Protects access to the fields below.  Most, but not all,
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
	// notYetSyncingBytes is the number of bytes that are dirty in the
	// file, but haven't yet started syncing to the server yet.
	notYetSyncingBytes int64
	// totalSyncBytes is the total number of outstanding dirty bytes
	// for this file, including those blocks that have already
	// finished syncing.
	totalSyncBytes int64
	// deferredNewBytes is the number of bytes that have been
	// deferred, and will be rewritten after the current sync
	// finishes.  It counts only new bytes that extended the file as
	// part of the deferred write.  This is useful in the case where
	// the current sync gets retried due to a recoverable error, and
	// those bytes get sucked into the retry and need to be accounted
	// for.
	deferredNewBytes int64
	// If there are too many deferred bytes outstanding, writes should
	// add themselves to this list.  They will be able to receive on
	// the channel on an outstanding Sync() completes.  If they
	// receive an error, they should fail the write.
	errListeners []chan<- error
}

func newDirtyFile(file path, dirtyBcache DirtyBlockCache) *dirtyFile {
	return &dirtyFile{
		path:            file,
		dirtyBcache:     dirtyBcache,
		fileBlockStates: make(map[BlockPointer]dirtyBlockState),
	}
}

func (df *dirtyFile) blockNeedsCopy(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].copy == blockNeedsCopy
}

func (df *dirtyFile) updateNotYetSyncingBytes(newBytes int64) {
	df.lock.Lock()
	defer df.lock.Unlock()
	df.notYetSyncingBytes += newBytes
	if df.notYetSyncingBytes < 0 {
		// It would be better if we didn't have this check, but it's
		// hard for folderBlockOps to account correctly when bytes in
		// a syncing block are overwritten, and then the write is
		// deferred (see KBFS-2157).
		df.notYetSyncingBytes = 0
	}
	df.dirtyBcache.UpdateUnsyncedBytes(df.path.Tlf, newBytes, false)
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

func (df *dirtyFile) isBlockOrphaned(ptr BlockPointer) bool {
	df.lock.Lock()
	defer df.lock.Unlock()
	return df.fileBlockStates[ptr].orphaned
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
	block, err := df.dirtyBcache.Get(df.path.Tlf, ptr, df.path.Branch)
	if err != nil {
		// The dirty block cache must always contain the dirty block
		// until the full sync is completely done.  If the block is
		// gone before we have even finished syncing it, that is a
		// fatal bug, because no one would be able to read the dirtied
		// version of the block.
		panic(err)
	}
	fblock, ok := block.(*FileBlock)
	if !ok {
		panic("Dirty file syncing a non-file block")
	}
	state.syncSize = int64(len(fblock.Contents))
	df.totalSyncBytes += state.syncSize
	df.notYetSyncingBytes -= state.syncSize
	df.fileBlockStates[ptr] = state
	df.dirtyBcache.UpdateSyncingBytes(df.path.Tlf, state.syncSize)
	return nil
}

func (df *dirtyFile) resetSyncingBlocksToDirty() {
	df.lock.Lock()
	defer df.lock.Unlock()
	// Reset all syncing blocks to just be dirty again
	syncFinishedNeeded := false
	for ptr, state := range df.fileBlockStates {
		if state.orphaned {
			// This block will never be sync'd again, so clear any
			// bytes from the buffer.
			if state.sync == blockSyncing {
				df.dirtyBcache.UpdateUnsyncedBytes(df.path.Tlf,
					-state.syncSize, true)
			} else if state.sync == blockSynced {
				// Some blocks did finish, so we might be able to
				// increase our buffer size.
				syncFinishedNeeded = true
			}
			state.syncSize = 0
			delete(df.fileBlockStates, ptr)
			continue
		}
		if state.sync == blockSynced {
			// Re-dirty the unsynced bytes (but don't touch the total
			// bytes).
			df.dirtyBcache.BlockSyncFinished(df.path.Tlf, -state.syncSize)
		} else if state.sync == blockSyncing {
			df.dirtyBcache.UpdateSyncingBytes(df.path.Tlf, -state.syncSize)
		}
		if state.sync != blockNotSyncing {
			state.copy = blockAlreadyCopied
			state.sync = blockNotSyncing
			state.syncSize = 0
			df.fileBlockStates[ptr] = state
		}
	}
	if syncFinishedNeeded {
		df.dirtyBcache.SyncFinished(df.path.Tlf, df.totalSyncBytes)
	}
	df.totalSyncBytes = 0 // all the blocks need to be re-synced.
}

func (df *dirtyFile) setBlockSyncedLocked(ptr BlockPointer) error {
	state, ok := df.fileBlockStates[ptr]
	if !ok || (state.copy == blockAlreadyCopied &&
		state.sync == blockNotSyncing) {
		// We've likely already had an resetSyncingBlocksToDirty; ignore.
		return nil
	}

	if state.sync != blockSyncing && !state.orphaned {
		return fmt.Errorf("Trying to finish a block sync that wasn't in "+
			"progress: %v (%v)", ptr, df.fileBlockStates[ptr])
	}
	state.sync = blockSynced
	df.dirtyBcache.BlockSyncFinished(df.path.Tlf, state.syncSize)
	// Keep syncSize set in case the block needs to be re-dirtied due
	// to an error.
	df.fileBlockStates[ptr] = state
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
		if state.orphaned {
			continue
		}
		if state.sync == blockSyncing {
			if found {
				return fmt.Errorf("Unexpected syncing block %v", ptr)
			}
			if ptr != df.path.tailPointer() {
				return fmt.Errorf("Unexpected syncing block %v; expected %v",
					ptr, df.path.tailPointer())
			}
			found = true
			err := df.setBlockSyncedLocked(ptr)
			if err != nil {
				return err
			}
		}
	}
	df.dirtyBcache.SyncFinished(df.path.Tlf, df.totalSyncBytes)
	df.totalSyncBytes = 0
	df.deferredNewBytes = 0
	if df.notYetSyncingBytes > 0 {
		// The sync will never happen (probably because the underlying
		// file was removed).
		df.dirtyBcache.UpdateUnsyncedBytes(df.path.Tlf,
			-df.notYetSyncingBytes, false)
		df.notYetSyncingBytes = 0
	}
	return nil
}

func (df *dirtyFile) addErrListener(listener chan<- error) {
	df.lock.Lock()
	defer df.lock.Unlock()
	df.errListeners = append(df.errListeners, listener)
}

func (df *dirtyFile) notifyErrListeners(err error) {
	df.lock.Lock()
	listeners := df.errListeners
	df.errListeners = nil
	df.lock.Unlock()
	if err == nil {
		return
	}
	for _, listener := range listeners {
		listener <- err
	}
}

func (df *dirtyFile) setBlockOrphaned(ptr BlockPointer, orphaned bool) {
	df.lock.Lock()
	defer df.lock.Unlock()
	state, ok := df.fileBlockStates[ptr]
	if !ok {
		return
	}
	state.orphaned = orphaned
	df.fileBlockStates[ptr] = state
}

func (df *dirtyFile) addDeferredNewBytes(bytes int64) {
	df.lock.Lock()
	defer df.lock.Unlock()
	df.deferredNewBytes += bytes
}

func (df *dirtyFile) assimilateDeferredNewBytes() {
	df.lock.Lock()
	defer df.lock.Unlock()
	if df.deferredNewBytes == 0 {
		return
	}
	df.dirtyBcache.UpdateUnsyncedBytes(df.path.Tlf, df.deferredNewBytes, false)
	df.deferredNewBytes = 0
}
