// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type fileBlockGetter func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (fblock *FileBlock, wasDirty bool, err error)
type dirtyBlockCacher func(ptr BlockPointer, block Block) error

// fileData is a helper struct for accessing and manipulating data
// within a file.  It's meant for use within a single scope, not for
// long-term storage.  The caller must ensure goroutine-safety.
type fileData struct {
	file   path
	uid    keybase1.UID
	crypto cryptoPure
	kmd    KeyMetadata
	bsplit BlockSplitter
	getter fileBlockGetter
	cacher dirtyBlockCacher
	log    logger.Logger
}

func newFileData(file path, uid keybase1.UID, crypto cryptoPure,
	bsplit BlockSplitter, kmd KeyMetadata, getter fileBlockGetter,
	cacher dirtyBlockCacher, log logger.Logger) *fileData {
	return &fileData{
		file:   file,
		uid:    uid,
		crypto: crypto,
		bsplit: bsplit,
		kmd:    kmd,
		getter: getter,
		cacher: cacher,
		log:    log,
	}
}

// parentBlockAndChildIndex is a node on a path down the tree to a
// particular leaf node.  `pblock` is an indirect block corresponding
// to one of that leaf node's parents, and `childIndex` is an index
// into `pblock.IPtrs` to the next node along the path.
type parentBlockAndChildIndex struct {
	pblock     *FileBlock
	childIndex int
}

func (fd *fileData) getFileBlockAtOffset(ctx context.Context,
	topBlock *FileBlock, off int64, rtype blockReqType) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block *FileBlock, nextBlockStartOff, startOff int64,
	wasDirty bool, err error) {
	// find the block matching the offset, if it exists
	ptr = fd.file.tailPointer()
	block = topBlock
	nextBlockStartOff = -1
	startOff = 0
	// search until it's not an indirect block
	for block.IsInd {
		nextIndex := len(block.IPtrs) - 1
		for i, iptr := range block.IPtrs {
			if iptr.Off == off {
				// small optimization to avoid iterating past the right ptr
				nextIndex = i
				break
			} else if iptr.Off > off {
				// i can never be 0, because the first ptr always has
				// an offset at the beginning of the range
				nextIndex = i - 1
				break
			}
		}
		nextPtr := block.IPtrs[nextIndex]
		parentBlocks = append(parentBlocks,
			parentBlockAndChildIndex{block, nextIndex})
		startOff = nextPtr.Off
		// there is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respective list
		if nextIndex != len(block.IPtrs)-1 {
			nextBlockStartOff = block.IPtrs[nextIndex+1].Off
		}
		ptr = nextPtr.BlockPointer
		block, wasDirty, err = fd.getter(ctx, fd.kmd, ptr, fd.file, rtype)
		if err != nil {
			return zeroPtr, nil, nil, 0, 0, false, err
		}
	}

	return ptr, parentBlocks, block, nextBlockStartOff, startOff, wasDirty, nil
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

// newRightBlock appends a new block (with a temporary ID) to the end
// of this file.
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

// write sets the given data and the given offset within the file,
// making new blocks and new levels of indirection as needed. Return
// params:
// * newDe: a new directory entry with the EncodedSize cleared if the file
//   was extended.
// * dirtyPtrs: a slice of the BlockPointers that have been dirtied during
//   the write.
// * unrefs: a slice of BlockInfos that must be unreferenced as part of an
//   eventual sync of this write.  May be non-nil even if err != nil.
// * newlyDirtiedChildBytes is the total amount of block data dirtied by this
//   write, including the entire size of blocks that have had at least one
//   byte dirtied.  As above, it may be non-zero even if err != nil.
// * bytesExtended is the number of bytes the length of the file has been
//   extended as part of this write.
func (fd *fileData) write(ctx context.Context, data []byte, off int64,
	topBlock *FileBlock, oldDe DirEntry, df *dirtyFile) (
	newDe DirEntry, dirtyPtrs []BlockPointer, unrefs []BlockInfo,
	newlyDirtiedChildBytes int64, bytesExtended int64, err error) {
	n := int64(len(data))
	nCopied := int64(0)
	oldSizeWithoutHoles := oldDe.Size
	newDe = oldDe

	for nCopied < n {
		ptr, parentBlocks, block, nextBlockOff, startOff, wasDirty, err :=
			fd.getFileBlockAtOffset(ctx, topBlock, off+nCopied, blockWrite)
		if err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}

		oldLen := len(block.Contents)

		// Take care not to write past the beginning of the next block
		// by using max.
		max := len(data)
		if nextBlockOff > 0 {
			if room := int(nextBlockOff - off); room < max {
				max = room
			}
		}
		oldNCopied := nCopied
		nCopied += fd.bsplit.CopyUntilSplit(
			block, nextBlockOff < 0, data[nCopied:max], off+nCopied-startOff)

		// TODO: support multiple levels of indirection.  Right now the
		// code only does one but it should be straightforward to
		// generalize, just annoying

		// if we need another block but there are no more, then make one
		switchToIndirect := false
		if nCopied < n && nextBlockOff < 0 {
			// If the block doesn't already have a parent block, make one.
			if ptr == fd.file.tailPointer() {
				topBlock, err = fd.createIndirectBlock(
					df, DefaultNewBlockDataVersion(false))
				if err != nil {
					return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
				}
				ptr = topBlock.IPtrs[0].BlockPointer
				// The whole block needs to be re-uploaded as an
				// indirect block, so track those dirty bytes and
				// cache the block as dirty.
				switchToIndirect = true
			}

			// Make a new right block and update the parent's
			// indirect block list
			err = fd.newRightBlock(ctx, fd.file.tailPointer(), topBlock,
				startOff+int64(len(block.Contents)))
			if err != nil {
				return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
			}
		} else if nCopied < n && off+nCopied < nextBlockOff {
			// We need a new block to be inserted here
			err = fd.newRightBlock(ctx, fd.file.tailPointer(), topBlock,
				startOff+int64(len(block.Contents)))
			if err != nil {
				return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
			}
			// And push the indirect pointers to right
			newb := topBlock.IPtrs[len(topBlock.IPtrs)-1]
			indexInParent := parentBlocks[0].childIndex
			copy(topBlock.IPtrs[indexInParent+2:],
				topBlock.IPtrs[indexInParent+1:])
			topBlock.IPtrs[indexInParent+1] = newb
			if oldSizeWithoutHoles == oldDe.Size {
				// For the purposes of calculating the newly-dirtied
				// bytes for the deferral calculation, disregard the
				// existing "hole" in the file.
				oldSizeWithoutHoles = uint64(newb.Off)
			}
		}

		// Nothing was copied, no need to dirty anything.  This can
		// happen when trying to append to the contents of the file
		// (i.e., either to the end of the file or right before the
		// "hole"), and the last block is already full.
		if nCopied == oldNCopied && !switchToIndirect {
			continue
		}

		// Only in the last block does the file size grow.
		if oldLen != len(block.Contents) && nextBlockOff < 0 {
			newDe.EncodedSize = 0
			// update the file info
			newDe.Size += uint64(len(block.Contents) - oldLen)
		}

		// Calculate the amount of bytes we've newly-dirtied as part
		// of this write.
		newlyDirtiedChildBytes += int64(len(block.Contents))
		if wasDirty {
			newlyDirtiedChildBytes -= int64(oldLen)
		}

		for _, pb := range parentBlocks {
			// Remember how many bytes it was.
			unrefs = append(unrefs, pb.pblock.IPtrs[pb.childIndex].BlockInfo)
			pb.pblock.IPtrs[pb.childIndex].EncodedSize = 0
		}

		// keep the old block ID while it's dirty
		if err = fd.cacher(ptr, block); err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}
		dirtyPtrs = append(dirtyPtrs, ptr)
	}

	if topBlock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any write to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the dirtyFiles map.
		if err = fd.cacher(fd.file.tailPointer(), topBlock); err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}
		dirtyPtrs = append(dirtyPtrs, fd.file.tailPointer())
	}

	lastByteWritten := off + int64(len(data)) // not counting holes
	bytesExtended = 0
	if lastByteWritten > int64(oldSizeWithoutHoles) {
		bytesExtended = lastByteWritten - int64(oldSizeWithoutHoles)
	}

	return newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, bytesExtended, nil
}

func (fd *fileData) truncateExtend(ctx context.Context, size uint64,
	topBlock *FileBlock, oldDe DirEntry, df *dirtyFile) (
	newDe DirEntry, dirtyPtrs []BlockPointer, err error) {
	fd.log.CDebugf(ctx, "truncateExtendLocked: extending fblock %#v", topBlock)
	if !topBlock.IsInd {
		fd.log.CDebugf(ctx, "truncateExtendLocked: making block indirect %v",
			fd.file.tailPointer())
		old := topBlock
		topBlock, err = fd.createIndirectBlock(
			df, DefaultNewBlockDataVersion(true))
		if err != nil {
			return DirEntry{}, nil, err
		}
		topBlock.IPtrs[0].Holes = true
		err = fd.cacher(topBlock.IPtrs[0].BlockPointer, old)
		if err != nil {
			return DirEntry{}, nil, err
		}
		dirtyPtrs = append(dirtyPtrs, topBlock.IPtrs[0].BlockPointer)
		fd.log.CDebugf(ctx, "truncateExtendLocked: new zero data block %v",
			topBlock.IPtrs[0].BlockPointer)
	}

	// TODO: support multiple levels of indirection.  Right now the
	// code only does one but it should be straightforward to
	// generalize, just annoying

	err = fd.newRightBlock(ctx, fd.file.tailPointer(), topBlock, int64(size))
	if err != nil {
		return DirEntry{}, nil, err
	}
	dirtyPtrs = append(dirtyPtrs,
		topBlock.IPtrs[len(topBlock.IPtrs)-1].BlockPointer)
	fd.log.CDebugf(ctx, "truncateExtendLocked: new right data block %v",
		topBlock.IPtrs[len(topBlock.IPtrs)-1].BlockPointer)

	newDe = oldDe
	newDe.EncodedSize = 0
	// update the file info
	newDe.Size = size

	// Mark all for presense of holes, one would be enough,
	// but this is more robust and easy.
	for i := range topBlock.IPtrs {
		topBlock.IPtrs[i].Holes = true
	}
	// Always make the top block dirty, so we will sync its
	// indirect blocks.  This has the added benefit of ensuring
	// that any write to a file while it's being sync'd will be
	// deferred, even if it's to a block that's not currently
	// being sync'd, since this top-most block will always be in
	// the fileBlockStates map.
	err = fd.cacher(fd.file.tailPointer(), topBlock)
	if err != nil {
		return DirEntry{}, nil, err
	}
	dirtyPtrs = append(dirtyPtrs, fd.file.tailPointer())
	return newDe, dirtyPtrs, nil
}

func (fd *fileData) truncateShrink(ctx context.Context, size uint64,
	topBlock *FileBlock, oldDe DirEntry) (
	newDe DirEntry, unrefs []BlockInfo, newlyDirtiedChildBytes int64,
	err error) {
	iSize := int64(size) // TODO: deal with overflow
	ptr, parentBlocks, block, nextBlockOff, startOff, wasDirty, err :=
		fd.getFileBlockAtOffset(ctx, topBlock, iSize, blockWrite)
	if err != nil {
		return DirEntry{}, nil, 0, err
	}

	oldLen := len(block.Contents)
	// We need to delete some data (and possibly entire blocks).
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)

	newlyDirtiedChildBytes = int64(len(block.Contents))
	if wasDirty {
		newlyDirtiedChildBytes -= int64(oldLen) // negative
	}

	if nextBlockOff > 0 {
		// TODO: if indexInParent == 0, we can remove the level of indirection.
		// TODO: support multiple levels of indirection.
		parentBlock := parentBlocks[0].pblock
		indexInParent := parentBlocks[0].childIndex
		for _, ptr := range parentBlock.IPtrs[indexInParent+1:] {
			unrefs = append(unrefs, ptr.BlockInfo)
		}
		parentBlock.IPtrs = parentBlock.IPtrs[:indexInParent+1]
		// always make the parent block dirty, so we will sync it
		if err = fd.cacher(fd.file.tailPointer(), parentBlock); err != nil {
			return DirEntry{}, nil, newlyDirtiedChildBytes, err
		}
	}

	if topBlock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any truncate to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the dirtyFiles map.
		if err = fd.cacher(fd.file.tailPointer(), topBlock); err != nil {
			return DirEntry{}, nil, newlyDirtiedChildBytes, err
		}
	}

	for _, pb := range parentBlocks {
		// Remember how many bytes it was.
		unrefs = append(unrefs, pb.pblock.IPtrs[pb.childIndex].BlockInfo)
		pb.pblock.IPtrs[pb.childIndex].EncodedSize = 0
	}

	newDe = oldDe
	newDe.EncodedSize = 0
	newDe.Size = size

	// Keep the old block ID while it's dirty.
	if err = fd.cacher(ptr, block); err != nil {
		return DirEntry{}, nil, newlyDirtiedChildBytes, err
	}

	return newDe, unrefs, newlyDirtiedChildBytes, nil
}

func (fd *fileData) split(ctx context.Context, id tlf.ID,
	dirtyBcache DirtyBlockCache, topBlock *FileBlock) (
	unrefs []BlockInfo, err error) {
	if !topBlock.IsInd {
		return nil, nil
	}

	// TODO: Verify that any getFileBlock... calls here
	// only use the dirty cache and not the network, since
	// the blocks are dirty.

	// For an indirect file:
	//   1) check if each dirty block is split at the right place.
	//   2) if it needs fewer bytes, prepend the extra bytes to the next
	//      block (making a new one if it doesn't exist), and the next block
	//      gets marked dirty
	//   3) if it needs more bytes, then use copyUntilSplit() to fetch bytes
	//      from the next block (if there is one), remove the copied bytes
	//      from the next block and mark it dirty
	//   4) Then go through once more, and ready and finalize each
	//      dirty block, updating its ID in the indirect pointer list
	for i := 0; i < len(topBlock.IPtrs); i++ {
		ptr := topBlock.IPtrs[i]
		isDirty := dirtyBcache.IsDirty(id, ptr.BlockPointer, fd.file.Branch)
		if (ptr.EncodedSize > 0) && isDirty {
			return unrefs, InconsistentEncodedSizeError{ptr.BlockInfo}
		}
		if !isDirty {
			continue
		}
		_, _, block, nextBlockOff, _, _, err :=
			fd.getFileBlockAtOffset(ctx, topBlock, ptr.Off, blockWrite)
		if err != nil {
			return unrefs, err
		}

		splitAt := fd.bsplit.CheckSplit(block)
		switch {
		case splitAt == 0:
			continue
		case splitAt > 0:
			endOfBlock := ptr.Off + int64(len(block.Contents))
			extraBytes := block.Contents[splitAt:]
			block.Contents = block.Contents[:splitAt]
			// put the extra bytes in front of the next block
			if nextBlockOff < 0 {
				// need to make a new block
				if err := fd.newRightBlock(
					ctx, fd.file.tailPointer(), topBlock,
					endOfBlock); err != nil {
					return unrefs, err
				}
			}
			rPtr, _, rblock, _, _, _, err :=
				fd.getFileBlockAtOffset(
					ctx, topBlock, endOfBlock, blockWrite)
			if err != nil {
				return unrefs, err
			}
			rblock.Contents = append(extraBytes, rblock.Contents...)
			if err = fd.cacher(rPtr, rblock); err != nil {
				return unrefs, err
			}
			topBlock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
			unrefs = append(unrefs, topBlock.IPtrs[i+1].BlockInfo)
			topBlock.IPtrs[i+1].EncodedSize = 0
		case splitAt < 0:
			if nextBlockOff < 0 {
				// end of the line
				continue
			}

			endOfBlock := ptr.Off + int64(len(block.Contents))
			rPtr, _, rblock, _, _, _, err :=
				fd.getFileBlockAtOffset(
					ctx, topBlock, endOfBlock, blockWrite)
			if err != nil {
				return unrefs, err
			}
			// copy some of that block's data into this block
			nCopied := fd.bsplit.CopyUntilSplit(block, false,
				rblock.Contents, int64(len(block.Contents)))
			rblock.Contents = rblock.Contents[nCopied:]
			if len(rblock.Contents) > 0 {
				if err = fd.cacher(rPtr, rblock); err != nil {
					return unrefs, err
				}
				topBlock.IPtrs[i+1].Off =
					ptr.Off + int64(len(block.Contents))
				unrefs = append(unrefs, topBlock.IPtrs[i+1].BlockInfo)
				topBlock.IPtrs[i+1].EncodedSize = 0
			} else {
				// TODO: delete the block, and if we're down
				// to just one indirect block, remove the
				// layer of indirection
				//
				// TODO: When we implement more than one level
				// of indirection, make sure that the pointer
				// to the parent block in the grandparent
				// block has EncodedSize 0.
				unrefs = append(unrefs, topBlock.IPtrs[i+1].BlockInfo)
				topBlock.IPtrs =
					append(topBlock.IPtrs[:i+1], topBlock.IPtrs[i+2:]...)
			}
		}
	}
	return unrefs, nil
}

// Need: newInfo->{readyBlockData, oldPtr}

func (fd *fileData) ready(ctx context.Context, id tlf.ID, bcache BlockCache,
	dirtyBcache DirtyBlockCache, bops BlockOps, bps *blockPutState,
	topBlock *FileBlock, df *dirtyFile) (map[BlockInfo]BlockPointer, error) {
	if !topBlock.IsInd {
		return nil, nil
	}

	oldPtrs := make(map[BlockInfo]BlockPointer)
	// TODO: handle multiple levels of indirection.
	for i := 0; i < len(topBlock.IPtrs); i++ {
		ptr := topBlock.IPtrs[i]
		isDirty := dirtyBcache.IsDirty(id, ptr.BlockPointer, fd.file.Branch)
		if (ptr.EncodedSize > 0) && isDirty {
			return nil, InconsistentEncodedSizeError{ptr.BlockInfo}
		}
		if !isDirty {
			continue
		}

		// Ready the dirty block.
		_, _, block, _, _, _, err := fd.getFileBlockAtOffset(
			ctx, topBlock, ptr.Off, blockWrite)
		if err != nil {
			return nil, err
		}

		newInfo, _, readyBlockData, err :=
			ReadyBlock(ctx, bcache, bops, fd.crypto, fd.kmd, block, fd.uid)
		if err != nil {
			return nil, err
		}

		err = bcache.Put(newInfo.BlockPointer, id, block, PermanentEntry)
		if err != nil {
			return nil, err
		}

		bps.addNewBlock(newInfo.BlockPointer, block, readyBlockData,
			func() error {
				return df.setBlockSynced(ptr.BlockPointer)
			})

		topBlock.IPtrs[i].BlockInfo = newInfo
		oldPtrs[newInfo] = ptr.BlockPointer
	}
	return oldPtrs, nil
}
