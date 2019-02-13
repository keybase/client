// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/pkg/errors"
)

// fileBlockMapMemory is an internal structure to track file block
// data in memory when putting blocks.
type fileBlockMapMemory struct {
	blocks map[BlockPointer]map[string]*FileBlock
}

var _ fileBlockMap = (*fileBlockMapMemory)(nil)

func newFileBlockMapMemory() *fileBlockMapMemory {
	return &fileBlockMapMemory{make(map[BlockPointer]map[string]*FileBlock)}
}

func (fbmm *fileBlockMapMemory) putTopBlock(
	_ context.Context, parentPtr BlockPointer, childName string,
	topBlock *FileBlock) error {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		nameMap = make(map[string]*FileBlock)
		fbmm.blocks[parentPtr] = nameMap
	}
	nameMap[childName] = topBlock
	return nil
}

func (fbmm *fileBlockMapMemory) getTopBlock(
	_ context.Context, parentPtr BlockPointer, childName string) (
	*FileBlock, error) {
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
	_ context.Context, parentPtr BlockPointer) (names []string, err error) {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		return nil, nil
	}
	names = make([]string, 0, len(nameMap))
	for name := range nameMap {
		names = append(names, name)
	}
	return names, nil
}
