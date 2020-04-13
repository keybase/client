// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/pkg/errors"
)

type fileBlockMapMemoryInfo struct {
	pps   data.PathPartString
	block *data.FileBlock
}

// fileBlockMapMemory is an internal structure to track file block
// data in memory when putting blocks.
type fileBlockMapMemory struct {
	blocks map[data.BlockPointer]map[string]fileBlockMapMemoryInfo
}

var _ fileBlockMap = (*fileBlockMapMemory)(nil)

func newFileBlockMapMemory() *fileBlockMapMemory {
	return &fileBlockMapMemory{
		blocks: make(map[data.BlockPointer]map[string]fileBlockMapMemoryInfo),
	}
}

func (fbmm *fileBlockMapMemory) putTopBlock(
	_ context.Context, parentPtr data.BlockPointer,
	childName data.PathPartString, topBlock *data.FileBlock) error {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		nameMap = make(map[string]fileBlockMapMemoryInfo)
		fbmm.blocks[parentPtr] = nameMap
	}
	nameMap[childName.Plaintext()] = fileBlockMapMemoryInfo{childName, topBlock}
	return nil
}

func (fbmm *fileBlockMapMemory) GetTopBlock(
	_ context.Context, parentPtr data.BlockPointer,
	childName data.PathPartString) (*data.FileBlock, error) {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		return nil, errors.Errorf("No such parent %s", parentPtr)
	}
	info, ok := nameMap[childName.Plaintext()]
	if !ok {
		return nil, errors.Errorf(
			"No such name %s in parent %s", childName, parentPtr)
	}
	return info.block, nil
}

func (fbmm *fileBlockMapMemory) getFilenames(
	_ context.Context, parentPtr data.BlockPointer) (
	names []data.PathPartString, err error) {
	nameMap, ok := fbmm.blocks[parentPtr]
	if !ok {
		return nil, nil
	}
	names = make([]data.PathPartString, 0, len(nameMap))
	for _, info := range nameMap {
		names = append(names, info.pps)
	}
	return names, nil
}
