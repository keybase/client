// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/pkg/errors"
)

// fileBlockMapMemory is an internal structure to track file block
// data in memory when putting blocks.
type fileBlockMapMemory struct {
	blocks map[data.BlockPointer]map[data.PathPartString]*data.FileBlock
}

var _ fileBlockMap = (*fileBlockMapMemory)(nil)

func newFileBlockMapMemory() *fileBlockMapMemory {
	return &fileBlockMapMemory{
		blocks: make(map[data.BlockPointer]map[data.PathPartString]*data.FileBlock),
	}
}

func (fbmm *fileBlockMapMemory) putTopBlock(
	_ context.Context, parentPtr data.BlockPointer,
	childName data.PathPartString, topBlock *data.FileBlock) error {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		nameMap = make(map[data.PathPartString]*data.FileBlock)
		fbmm.blocks[parentPtr] = nameMap
	}
	nameMap[childName] = topBlock
	return nil
}

func (fbmm *fileBlockMapMemory) GetTopBlock(
	_ context.Context, parentPtr data.BlockPointer,
	childName data.PathPartString) (*data.FileBlock, error) {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		return nil, errors.Errorf("No such parent %s", parentPtr)
	}
	block, ok := nameMap[childName]
	if !ok {
		return nil, errors.Errorf(
			"No such name %s in parent %s", childName, parentPtr)
	}
	return block, nil
}

func (fbmm *fileBlockMapMemory) getFilenames(
	_ context.Context, parentPtr data.BlockPointer) (
	names []data.PathPartString, err error) {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		return nil, nil
	}
	names = make([]data.PathPartString, 0, len(nameMap))
	for name := range nameMap {
		names = append(names, name)
	}
	return names, nil
}
