// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type pathSyncer struct {
	config Config
	blocks *folderBlockOps
	log    logger.Logger
}

func (ps pathSyncer) readyBlockMultiple(ctx context.Context,
	kmd KeyMetadata, currBlock Block, uid keybase1.UID,
	bps *blockPutState, bType keybase1.BlockType) (
	info BlockInfo, plainSize int, err error) {
	info, plainSize, readyBlockData, err :=
		ReadyBlock(ctx, ps.config.BlockCache(), ps.config.BlockOps(),
			ps.config.Crypto(), kmd, currBlock, uid, bType)
	if err != nil {
		return
	}

	bps.addNewBlock(info.BlockPointer, currBlock, readyBlockData, nil)
	return
}

func (ps pathSyncer) nowUnixNano() int64 {
	return ps.config.Clock().Now().UnixNano()
}

// syncBlock updates, and readies, the blocks along the path for the
// given write, up to the root of the tree or stopAt (if specified).
// When it updates the root of the tree, it also modifies the given
// head object with a new revision number and root block ID.  It first
// checks the provided lbc for blocks that may have been modified by
// previous syncBlock calls or the FS calls themselves.  It returns
// the updated path to the changed directory, the new or updated
// directory entry created as part of the call, and a summary of all
// the blocks that now must be put to the block server.
//
// This function is safe to use unlocked, but may modify MD to have
// the same revision number as another one. All functions in this file
// must call syncBlockLocked instead, which holds mdWriterLock and
// thus serializes the revision numbers. Conflict resolution may call
// syncBlockForConflictResolution, which doesn't hold the lock, since
// it already handles conflicts correctly.
//
// entryType must not be Sym.
//
// TODO: deal with multiple nodes for indirect blocks
func (ps pathSyncer) syncBlock(
	ctx context.Context, lState *lockState, uid keybase1.UID,
	md *RootMetadata, newBlock Block, dir path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer,
	lbc localBcache) (path, DirEntry, *blockPutState, error) {
	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	currName := name
	newPath := path{
		FolderBranch: dir.FolderBranch,
		path:         make([]pathNode, 0, len(dir.path)),
	}
	bps := newBlockPutState(len(dir.path))
	refPath := dir.ChildPathNoPtr(name)
	var newDe DirEntry
	doSetTime := true
	now := ps.nowUnixNano()
	for len(newPath.path) < len(dir.path)+1 {
		info, plainSize, err := ps.readyBlockMultiple(
			ctx, md.ReadOnly(), currBlock, uid, bps, keybase1.BlockType_DATA)
		if err != nil {
			return path{}, DirEntry{}, nil, err
		}

		// prepend to path and setup next one
		newPath.path = append([]pathNode{{info.BlockPointer, currName}},
			newPath.path...)

		// get the parent block
		prevIdx := len(dir.path) - len(newPath.path)
		var prevDblock *DirBlock
		var de DirEntry
		var nextName string
		nextDoSetTime := false
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = md.data.Dir
		} else {
			prevDir := path{
				FolderBranch: dir.FolderBranch,
				path:         dir.path[:prevIdx+1],
			}

			// First, check the localBcache, which could contain
			// blocks that were modified across multiple calls to
			// syncBlock.
			var ok bool
			prevDblock, ok = lbc[prevDir.tailPointer()]
			if !ok {
				// If the block isn't in the local bcache, we
				// have to fetch it, possibly from the
				// network. Directory blocks are only ever
				// modified while holding mdWriterLock, so it's
				// safe to fetch them one at a time.
				prevDblock, err = ps.blocks.GetDir(
					ctx, lState, md.ReadOnly(), prevDir, blockWrite)
				if err != nil {
					return path{}, DirEntry{}, nil, err
				}
			}

			// modify the direntry for currName; make one
			// if it doesn't exist (which should only
			// happen the first time around).
			//
			// TODO: Pull the creation out of here and
			// into createEntryLocked().
			if de, ok = prevDblock.Children[currName]; !ok {
				// If this isn't the first time
				// around, we have an error.
				if len(newPath.path) > 1 {
					return path{}, DirEntry{}, nil, NoSuchNameError{currName}
				}

				// If this is a file, the size should be 0. (TODO:
				// Ensure this.) If this is a directory, the size will
				// be filled in below.  The times will be filled in
				// below as well, since we should only be creating a
				// new directory entry when doSetTime is true.
				de = DirEntry{
					EntryInfo: EntryInfo{
						Type: entryType,
						Size: 0,
					},
				}
				// If we're creating a new directory entry, the
				// parent's times must be set as well.
				nextDoSetTime = true
			}

			currBlock = prevDblock
			nextName = prevDir.tailName()
		}

		if de.Type == Dir {
			// TODO: When we use indirect dir blocks,
			// we'll have to calculate the size some other
			// way.
			de.Size = uint64(plainSize)
		}

		if prevIdx < 0 {
			md.AddUpdate(md.data.Dir.BlockInfo, info)
		} else if prevDe, ok := prevDblock.Children[currName]; ok {
			md.AddUpdate(prevDe.BlockInfo, info)
		} else {
			// this is a new block
			md.AddRefBlock(info)
		}

		if len(refPath.path) > 1 {
			refPath = *refPath.parentPath()
		}
		de.BlockInfo = info

		if doSetTime {
			if mtime {
				de.Mtime = now
			}
			if ctime {
				de.Ctime = now
			}
		}
		if !newDe.IsInitialized() {
			newDe = de
		}

		if prevIdx < 0 {
			md.data.Dir = de
		} else {
			prevDblock.Children[currName] = de
		}
		currName = nextName

		// Stop before we get to the common ancestor; it will be taken care of
		// on the next sync call
		if prevIdx >= 0 && dir.path[prevIdx].BlockPointer == stopAt {
			// Put this back into the cache as dirty -- the next
			// syncBlock call will ready it.
			dblock, ok := currBlock.(*DirBlock)
			if !ok {
				return path{}, DirEntry{}, nil, BadDataError{stopAt.ID}
			}
			lbc[stopAt] = dblock
			break
		}
		doSetTime = nextDoSetTime
	}

	return newPath, newDe, bps, nil
}
