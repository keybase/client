// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/pkg/errors"
)

// fileBlockMapDisk tracks block info while making a revision, by
// using a disk-based block cache.
type fileBlockMapDisk struct {
	dirtyBcache *DirtyBlockCacheDisk
	kmd         libkey.KeyMetadata
	ptrs        map[BlockPointer]map[string]BlockPointer
}

var _ fileBlockMap = (*fileBlockMapDisk)(nil)

func newFileBlockMapDisk(
	dirtyBcache *DirtyBlockCacheDisk, kmd libkey.KeyMetadata) *fileBlockMapDisk {
	return &fileBlockMapDisk{
		dirtyBcache: dirtyBcache,
		kmd:         kmd,
		ptrs:        make(map[BlockPointer]map[string]BlockPointer),
	}
}

func (fbmd *fileBlockMapDisk) putTopBlock(
	ctx context.Context, parentPtr BlockPointer, childName string,
	topBlock *FileBlock) error {
	// To reuse the DirtyBlockCacheDisk code, we need to assign a
	// random BlockPointer to this block.
	id, err := kbfsblock.MakeTemporaryID()
	if err != nil {
		return err
	}
	ptr := BlockPointer{ID: id}

	err = fbmd.dirtyBcache.Put(
		ctx, fbmd.kmd.TlfID(), ptr, MasterBranch, topBlock)
	if err != nil {
		return err
	}

	ptrMap, ok := fbmd.ptrs[parentPtr]
	if !ok {
		ptrMap = make(map[string]BlockPointer)
		fbmd.ptrs[parentPtr] = ptrMap
	}

	ptrMap[childName] = ptr
	return nil
}

func (fbmd *fileBlockMapDisk) getTopBlock(
	ctx context.Context, parentPtr BlockPointer, childName string) (
	*FileBlock, error) {
	ptrMap, ok := fbmd.ptrs[parentPtr]
	if !ok {
		return nil, errors.Errorf("No such parent %s", parentPtr)
	}
	ptr, ok := ptrMap[childName]
	if !ok {
		return nil, errors.Errorf(
			"No such name %s in parent %s", childName, parentPtr)
	}
	block, err := fbmd.dirtyBcache.Get(ctx, fbmd.kmd.TlfID(), ptr, MasterBranch)
	if err != nil {
		return nil, err
	}
	fblock, ok := block.(*FileBlock)
	if !ok {
		return nil, errors.Errorf(
			"Unexpected block type for file block: %T", block)
	}
	return fblock, nil
}

func (fbmd *fileBlockMapDisk) getFilenames(
	_ context.Context, parentPtr BlockPointer) (names []string, err error) {
	ptrMap, ok := fbmd.ptrs[parentPtr]
	if !ok {
		return nil, nil
	}
	names = make([]string, 0, len(ptrMap))
	for name := range ptrMap {
		names = append(names, name)
	}
	return names, nil
}
