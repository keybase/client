// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/pkg/errors"
)

// dirBlockMapMemory is an internal structure to track file block
// data in memory when putting blocks.
type dirBlockMapMemory struct {
	blocks map[data.BlockPointer]*data.DirBlock
}

var _ dirBlockMap = (*dirBlockMapMemory)(nil)

func newDirBlockMapMemory() *dirBlockMapMemory {
	return &dirBlockMapMemory{make(map[data.BlockPointer]*data.DirBlock)}
}

func (dbmm *dirBlockMapMemory) putBlock(
	_ context.Context, ptr data.BlockPointer, block *data.DirBlock) error {
	dbmm.blocks[ptr] = block
	return nil
}

func (dbmm *dirBlockMapMemory) getBlock(
	_ context.Context, ptr data.BlockPointer) (*data.DirBlock, error) {
	block, ok := dbmm.blocks[ptr]
	if !ok {
		return nil, errors.Errorf("No such block for %s", ptr)
	}
	return block, nil
}

func (dbmm *dirBlockMapMemory) hasBlock(
	_ context.Context, ptr data.BlockPointer) (bool, error) {
	_, ok := dbmm.blocks[ptr]
	return ok, nil
}

func (dbmm *dirBlockMapMemory) deleteBlock(
	_ context.Context, ptr data.BlockPointer) error {
	delete(dbmm.blocks, ptr)
	return nil
}

func (dbmm *dirBlockMapMemory) numBlocks() int {
	return len(dbmm.blocks)
}
