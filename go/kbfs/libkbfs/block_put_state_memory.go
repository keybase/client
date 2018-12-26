// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/pkg/errors"
)

type blockState struct {
	block          Block
	readyBlockData ReadyBlockData
	syncedCb       func() error
	oldPtr         BlockPointer
}

// blockPutStateMemory is an internal structure to track data in
// memory when putting blocks.
type blockPutStateMemory struct {
	blockStates map[BlockPointer]blockState
	lastBlock   BlockPointer
}

var _ blockPutState = (*blockPutStateMemory)(nil)

func newBlockPutStateMemory(length int) *blockPutStateMemory {
	bps := &blockPutStateMemory{}
	bps.blockStates = make(map[BlockPointer]blockState, length)
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
	bps.blockStates[blockPtr] = blockState{
		block, readyBlockData, syncedCb, zeroPtr}
	bps.lastBlock = blockPtr
	return nil
}

// saveOldPtr stores the given BlockPointer as the old (pre-readied)
// pointer for the most recent blockState.
func (bps *blockPutStateMemory) saveOldPtr(
	_ context.Context, oldPtr BlockPointer) error {
	if bps.lastBlock == zeroPtr {
		return errors.New("No blocks have been added")
	}
	bs, ok := bps.blockStates[bps.lastBlock]
	if !ok {
		return errors.Errorf("Last block %v doesn't exist", bps.lastBlock)
	}
	bs.oldPtr = oldPtr
	bps.blockStates[bps.lastBlock] = bs
	return nil
}

func (bps *blockPutStateMemory) oldPtr(
	_ context.Context, blockPtr BlockPointer) (BlockPointer, error) {
	bs, ok := bps.blockStates[blockPtr]
	if ok {
		return bs.oldPtr, nil
	}
	return BlockPointer{}, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) mergeOtherBps(
	_ context.Context, other blockPutState) error {
	otherMem, ok := other.(*blockPutStateMemory)
	if !ok {
		return errors.Errorf("Cannot remove other bps of type %T", other)
	}

	for ptr, bs := range otherMem.blockStates {
		bps.blockStates[ptr] = bs
	}
	return nil
}

func (bps *blockPutStateMemory) removeOtherBps(
	ctx context.Context, other blockPutState) error {
	otherMem, ok := other.(*blockPutStateMemory)
	if !ok {
		return errors.Errorf("Cannot remove other bps of type %T", other)
	}
	if len(otherMem.blockStates) == 0 {
		return nil
	}

	otherMemPtrs := make(map[BlockPointer]bool, len(otherMem.blockStates))
	for ptr := range otherMem.blockStates {
		otherMemPtrs[ptr] = true
	}

	newBps, err := bps.deepCopyWithBlacklist(ctx, otherMemPtrs)
	if err != nil {
		return err
	}
	newBpsMem, ok := newBps.(*blockPutStateMemory)
	if !ok {
		return errors.Errorf(
			"Bad deep copy type when removing blocks: %T", newBps)
	}

	bps.blockStates = newBpsMem.blockStates
	return nil
}

func (bps *blockPutStateMemory) ptrs() []BlockPointer {
	ret := make([]BlockPointer, len(bps.blockStates))
	i := 0
	for ptr := range bps.blockStates {
		ret[i] = ptr
		i++
	}
	return ret
}

func (bps *blockPutStateMemory) getBlock(
	_ context.Context, blockPtr BlockPointer) (Block, error) {
	bs, ok := bps.blockStates[blockPtr]
	if ok {
		return bs.block, nil
	}
	return nil, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) getReadyBlockData(
	_ context.Context, blockPtr BlockPointer) (ReadyBlockData, error) {
	bs, ok := bps.blockStates[blockPtr]
	if ok {
		return bs.readyBlockData, nil
	}
	return ReadyBlockData{}, errors.WithStack(NoSuchBlockError{blockPtr.ID})
}

func (bps *blockPutStateMemory) synced(blockPtr BlockPointer) error {
	bs, ok := bps.blockStates[blockPtr]
	if ok && bs.syncedCb != nil {
		return bs.syncedCb()
	}
	return nil
}

func (bps *blockPutStateMemory) numBlocks() int {
	return len(bps.blockStates)
}

func (bps *blockPutStateMemory) deepCopy(
	_ context.Context) (blockPutState, error) {
	newBps := &blockPutStateMemory{}
	newBps.blockStates = make(map[BlockPointer]blockState, len(bps.blockStates))
	for ptr, bs := range bps.blockStates {
		newBps.blockStates[ptr] = bs
	}
	return newBps, nil
}

func (bps *blockPutStateMemory) deepCopyWithBlacklist(
	_ context.Context, blacklist map[BlockPointer]bool) (blockPutState, error) {
	newBps := &blockPutStateMemory{}
	newLen := len(bps.blockStates) - len(blacklist)
	if newLen < 0 {
		newLen = 0
	}
	newBps.blockStates = make(map[BlockPointer]blockState, newLen)
	for ptr, bs := range bps.blockStates {
		// Only save the good pointers
		if !blacklist[ptr] {
			newBps.blockStates[ptr] = bs
		}
	}
	return newBps, nil
}
