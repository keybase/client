// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

// DirtyBlockCacheStandard implements the DirtyBlockCache interface by
// storing blocks in an in-memory cache.  Dirty blocks are identified
// by their block ID, branch name, and reference nonce, since the same
// block may be forked and modified on different branches and under
// different references simultaneously.
type DirtyBlockCacheStandard struct {
	dirtyLock          sync.Mutex
	dirty              map[dirtyBlockID]Block
	dirtyBytesEstimate uint64
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.
func NewDirtyBlockCacheStandard() *DirtyBlockCacheStandard {
	return &DirtyBlockCacheStandard{
		dirty: make(map[dirtyBlockID]Block),
	}
}

// Get implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Get(ptr BlockPointer, branch BranchName) (
	Block, error) {
	block := func() Block {
		dirtyID := dirtyBlockID{
			id:       ptr.ID,
			refNonce: ptr.RefNonce,
			branch:   branch,
		}
		d.dirtyLock.Lock()
		defer d.dirtyLock.Unlock()
		return d.dirty[dirtyID]
	}()
	if block != nil {
		return block, nil
	}

	return nil, NoSuchBlockError{ptr.ID}
}

// Put implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Put(ptr BlockPointer, branch BranchName,
	block Block) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.dirtyLock.Lock()
	defer d.dirtyLock.Unlock()
	d.dirty[dirtyID] = block
	d.dirtyBytesEstimate = 0
	return nil
}

// Delete implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Delete(ptr BlockPointer,
	branch BranchName) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.dirtyLock.Lock()
	defer d.dirtyLock.Unlock()
	delete(d.dirty, dirtyID)
	d.dirtyBytesEstimate = 0
	return nil
}

// IsDirty implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) IsDirty(
	ptr BlockPointer, branch BranchName) (isDirty bool) {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.dirtyLock.Lock()
	defer d.dirtyLock.Unlock()
	_, isDirty = d.dirty[dirtyID]
	return
}

// DirtyBytesEstimate implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) DirtyBytesEstimate() uint64 {
	d.dirtyLock.Lock()
	defer d.dirtyLock.Unlock()
	if d.dirtyBytesEstimate == 0 {
		// Users of this cache can update dirty blocks at will, so
		// it's not possible to return the exact sizes of the blocks.
		// Just cache what we have until we know for sure that it's
		// changed (because a new block is added, for example).
		for _, block := range d.dirty {
			d.dirtyBytesEstimate += uint64(getCachedBlockSize(block))
		}
	}
	return d.dirtyBytesEstimate
}
