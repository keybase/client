// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type fileBlockGetter func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (*FileBlock, error)
type dirtyBlockCacher func(ptr BlockPointer, block Block) error

// fileData is a helper struct for accessing and manipulating data
// within a file.  It's meant for use within a single scope, not for
// long-term storage.  The caller must ensure goroutine-safety.
type fileData struct {
	file   path
	uid    keybase1.UID
	crypto Crypto
	kmd    KeyMetadata
	getter fileBlockGetter
	cacher dirtyBlockCacher
}

func newFileData(file path, uid keybase1.UID, crypto Crypto,
	kmd KeyMetadata, getter fileBlockGetter,
	cacher dirtyBlockCacher) *fileData {
	return &fileData{
		file:   file,
		uid:    uid,
		crypto: crypto,
		kmd:    kmd,
		getter: getter,
		cacher: cacher,
	}
}

func (fd *fileData) getFileBlockAtOffset(ctx context.Context,
	topBlock *FileBlock, off int64, rtype blockReqType) (
	ptr BlockPointer, parentBlock *FileBlock, indexInParent int,
	block *FileBlock, nextBlockStartOff, startOff int64, err error) {
	// find the block matching the offset, if it exists
	ptr = fd.file.tailPointer()
	block = topBlock
	nextBlockStartOff = -1
	startOff = 0
	// search until it's not an indirect block
	for block.IsInd {
		nextIndex := len(block.IPtrs) - 1
		for i, ptr := range block.IPtrs {
			if ptr.Off == off {
				// small optimization to avoid iterating past the right ptr
				nextIndex = i
				break
			} else if ptr.Off > off {
				// i can never be 0, because the first ptr always has
				// an offset at the beginning of the range
				nextIndex = i - 1
				break
			}
		}
		nextPtr := block.IPtrs[nextIndex]
		parentBlock = block
		indexInParent = nextIndex
		startOff = nextPtr.Off
		// there is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respective list
		if nextIndex != len(block.IPtrs)-1 {
			nextBlockStartOff = block.IPtrs[nextIndex+1].Off
		}
		ptr = nextPtr.BlockPointer
		block, err = fd.getter(ctx, fd.kmd, ptr, fd.file, rtype)
		if err != nil {
			return zeroPtr, nil, 0, nil, 0, 0, err
		}
	}

	return ptr, parentBlock, indexInParent, block, nextBlockStartOff,
		startOff, nil
}

// createIndirectBlock creates a new indirect block and pick a new id
// for the existing block, and use the existing block's ID for the new
// indirect block that becomes the parent.
func (fd *fileData) createIndirectBlock(
	df *dirtyFile, dver DataVer) (*FileBlock, error) {
	newID, err := fd.crypto.MakeTemporaryBlockID()
	if err != nil {
		return nil, err
	}
	fblock := &FileBlock{
		CommonBlock: CommonBlock{
			IsInd: true,
		},
		IPtrs: []IndirectFilePtr{
			{
				BlockInfo: BlockInfo{
					BlockPointer: BlockPointer{
						ID:      newID,
						KeyGen:  fd.kmd.LatestKeyGeneration(),
						DataVer: dver,
						BlockContext: BlockContext{
							Creator:  fd.uid,
							RefNonce: ZeroBlockRefNonce,
						},
					},
					EncodedSize: 0,
				},
				Off: 0,
			},
		},
	}

	// Mark the old block ID as not dirty, so that we will treat the
	// old block ID as newly dirtied in cacheBlockIfNotYetDirtyLocked.
	df.setBlockNotDirty(fd.file.tailPointer())
	err = fd.cacher(fd.file.tailPointer(), fblock)
	if err != nil {
		return nil, err
	}

	return fblock, nil
}

func (fd *fileData) newRightBlock(
	ctx context.Context, ptr BlockPointer, pblock *FileBlock,
	off int64) error {
	newRID, err := fd.crypto.MakeTemporaryBlockID()
	if err != nil {
		return err
	}
	rblock := &FileBlock{}

	newPtr := BlockPointer{
		ID:      newRID,
		KeyGen:  fd.kmd.LatestKeyGeneration(),
		DataVer: DefaultNewBlockDataVersion(false),
		BlockContext: BlockContext{
			Creator:  fd.uid,
			RefNonce: ZeroBlockRefNonce,
		},
	}

	pblock.IPtrs = append(pblock.IPtrs, IndirectFilePtr{
		BlockInfo: BlockInfo{
			BlockPointer: newPtr,
			EncodedSize:  0,
		},
		Off: off,
	})

	err = fd.cacher(newPtr, rblock)
	if err != nil {
		return err
	}
	err = fd.cacher(ptr, pblock)
	if err != nil {
		return err
	}
	return nil
}
