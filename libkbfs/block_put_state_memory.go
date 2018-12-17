// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/pkg/errors"
)

type blockState struct {
	blockPtr       BlockPointer
	block          Block
	readyBlockData ReadyBlockData
	syncedCb       func() error
	oldPtr         BlockPointer
}

// blockPutStateMemory is an internal structure to track data in
// memory when putting blocks.
type blockPutStateMemory struct {
	blockStates []blockState
}

var _ blockPutState = (*blockPutStateMemory)(nil)

func newBlockPutStateMemory(length int) *blockPutStateMemory {
	bps := &blockPutStateMemory{}
	bps.blockStates = make([]blockState, 0, length)
	return bps
}

// addNewBlock tracks a new block that will be put.  If syncedCb is
// non-nil, it will be called whenever the put for that block is
// complete (whether or not the put resulted in an error).  Currently
// it will not be called if the block is never put (due to an earlier
// error).
func (bps *blockPutStateMemory) addNewBlock(
	_ context.Context, blockPtr BlockPointer, block Block,
	readyBlockData ReadyBlockData, syncedCb func() error) error {
	bps.blockStates = append(bps.blockStates,
		blockState{blockPtr, block, readyBlockData, syncedCb, zeroPtr})
	return nil
}

// saveOldPtr stores the given BlockPointer as the old (pre-readied)
// pointer for the most recent blockState.
func (bps *blockPutStateMemory) saveOldPtr(
	_ context.Context, oldPtr BlockPointer) error {
	bps.blockStates[len(bps.blockStates)-1].oldPtr = oldPtr
	return nil
}

func (bps *blockPutStateMemory) oldPtr(
	_ context.Context, blockPtr BlockPointer) (BlockPointer, error) {
	for _, bs := range bps.blockStates {
		if bs.blockPtr == blockPtr {
			return bs.oldPtr, nil
		}
	}
	return BlockPointer{}, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) mergeOtherBps(
	_ context.Context, other blockPutState) error {
	otherMem, ok := other.(*blockPutStateMemory)
	if !ok {
		return errors.Errorf("Cannot remove other bps of type %T", other)
	}

	bps.blockStates = append(bps.blockStates, otherMem.blockStates...)
	return nil
}

func (bps *blockPutStateMemory) removeOtherBps(
	_ context.Context, other blockPutState) error {
	otherMem, ok := other.(*blockPutStateMemory)
	if !ok {
		return errors.Errorf("Cannot remove other bps of type %T", other)
	}
	if len(otherMem.blockStates) == 0 {
		return nil
	}

	otherMemPtrs := make(map[BlockPointer]bool, len(otherMem.blockStates))
	for _, bs := range otherMem.blockStates {
		otherMemPtrs[bs.blockPtr] = true
	}

	// Assume that `otherMem` is a subset of `bps` when initializing the
	// slice length.
	newLen := len(bps.blockStates) - len(otherMem.blockStates)
	if newLen < 0 {
		newLen = 0
	}

	// Remove any blocks that appear in `otherMem`.
	newBlockStates := make([]blockState, 0, newLen)
	for _, bs := range bps.blockStates {
		if otherMemPtrs[bs.blockPtr] {
			continue
		}
		newBlockStates = append(newBlockStates, bs)
	}
	bps.blockStates = newBlockStates
	return nil
}

func (bps *blockPutStateMemory) ptrs() []BlockPointer {
	ret := make([]BlockPointer, len(bps.blockStates))
	for i, bs := range bps.blockStates {
		ret[i] = bs.blockPtr
	}
	return ret
}

func (bps *blockPutStateMemory) getBlock(
	_ context.Context, blockPtr BlockPointer) (Block, error) {
	for _, bs := range bps.blockStates {
		if bs.blockPtr == blockPtr {
			return bs.block, nil
		}
	}
	return nil, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) getReadyBlockData(
	_ context.Context, blockPtr BlockPointer) (ReadyBlockData, error) {
	for _, bs := range bps.blockStates {
		if bs.blockPtr == blockPtr {
			return bs.readyBlockData, nil
		}
	}
	return ReadyBlockData{}, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) synced(blockPtr BlockPointer) error {
	for _, bs := range bps.blockStates {
		if bs.blockPtr == blockPtr {
			if bs.syncedCb != nil {
				return bs.syncedCb()
			}
			return nil
		}
	}
	return nil
}

func (bps *blockPutStateMemory) numBlocks() int {
	return len(bps.blockStates)
}

func (bps *blockPutStateMemory) deepCopy(
	_ context.Context) (blockPutState, error) {
	newBps := &blockPutStateMemory{}
	newBps.blockStates = make([]blockState, len(bps.blockStates))
	copy(newBps.blockStates, bps.blockStates)
	return newBps, nil
}

func (bps *blockPutStateMemory) deepCopyWithBlacklist(
	_ context.Context, blacklist map[BlockPointer]bool) (blockPutState, error) {
	newBps := &blockPutStateMemory{}
	newCap := len(bps.blockStates) - len(blacklist)
	if newCap < 0 {
		newCap = 0
	}
	newBps.blockStates = make([]blockState, 0, newCap)
	for _, bs := range bps.blockStates {
		// Only save the good pointers
		if !blacklist[bs.blockPtr] {
			newBps.blockStates = append(newBps.blockStates, bs)
		}
	}
	return newBps, nil
}
