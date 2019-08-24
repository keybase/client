// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// folderUpdatePrepper is a helper struct for preparing blocks and MD
// updates before they get synced to the backend servers.  It can be
// used for a single update or for a batch of updates (e.g. conflict
// resolution).
type folderUpdatePrepper struct {
	config       Config
	folderBranch data.FolderBranch
	blocks       *folderBlockOps
	log          logger.Logger
	vlog         *libkb.VDebugLog

	cacheLock   sync.Mutex
	cachedInfos map[data.BlockPointer]data.BlockInfo
}

func (fup *folderUpdatePrepper) id() tlf.ID {
	return fup.folderBranch.Tlf
}

func (fup *folderUpdatePrepper) branch() data.BranchName {
	return fup.folderBranch.Branch
}

func (fup *folderUpdatePrepper) nowUnixNano() int64 {
	return fup.config.Clock().Now().UnixNano()
}

func (fup *folderUpdatePrepper) readyBlockMultiple(ctx context.Context,
	kmd libkey.KeyMetadata, currBlock data.Block, chargedTo keybase1.UserOrTeamID,
	bps blockPutState, bType keybase1.BlockType) (
	info data.BlockInfo, plainSize int, err error) {
	info, plainSize, readyBlockData, err :=
		data.ReadyBlock(ctx, fup.config.BlockCache(), fup.config.BlockOps(),
			kmd, currBlock, chargedTo, bType)
	if err != nil {
		return data.BlockInfo{}, 0, err
	}

	err = bps.AddNewBlock(
		ctx, info.BlockPointer, currBlock, readyBlockData, nil)
	if err != nil {
		return data.BlockInfo{}, 0, err
	}
	return info, plainSize, nil
}

func (fup *folderUpdatePrepper) unembedBlockChanges(
	ctx context.Context, bps blockPutState, md *RootMetadata,
	changes *BlockChanges, chargedTo keybase1.UserOrTeamID) error {
	buf, err := fup.config.Codec().Encode(changes)
	if err != nil {
		return err
	}

	// Treat the block change list as a file so we can reuse all the
	// indirection code in fileData.
	block := data.NewFileBlock().(*data.FileBlock)
	id, err := fup.config.cryptoPure().MakeTemporaryBlockID()
	if err != nil {
		return err
	}
	ptr := data.BlockPointer{
		ID:         id,
		KeyGen:     md.LatestKeyGeneration(),
		DataVer:    fup.config.DataVersion(),
		DirectType: data.DirectBlock,
		Context: kbfsblock.MakeFirstContext(
			chargedTo, keybase1.BlockType_MD),
	}
	file := data.Path{
		FolderBranch: fup.folderBranch,
		Path: []data.PathNode{{
			BlockPointer: ptr,
			Name: data.NewPathPartString(
				fmt.Sprintf("<MD rev %d>", md.Revision()), nil),
		},
		}}

	dirtyBcache := data.SimpleDirtyBlockCacheStandard()
	// Simple dirty bcaches don't need to be shut down.

	getter := func(ctx context.Context, _ libkey.KeyMetadata, ptr data.BlockPointer,
		_ data.Path, _ data.BlockReqType) (*data.FileBlock, bool, error) {
		block, err := dirtyBcache.Get(ctx, fup.id(), ptr, fup.branch())
		if err != nil {
			return nil, false, err
		}
		fblock, ok := block.(*data.FileBlock)
		if !ok {
			return nil, false, errors.Errorf(
				"Block for %s is not a file block, block type: %T", ptr, block)
		}
		return fblock, true, nil
	}
	cacher := func(ctx context.Context, ptr data.BlockPointer, block data.Block) error {
		return dirtyBcache.Put(ctx, fup.id(), ptr, fup.branch(), block)
	}
	// Start off the cache with the new block
	err = cacher(ctx, ptr, block)
	if err != nil {
		return err
	}

	df := data.NewDirtyFile(file, dirtyBcache)
	fd := data.NewFileData(
		file, chargedTo, fup.config.BlockSplitter(), md.ReadOnly(), getter,
		cacher, fup.log, fup.vlog)

	// Write all the data.
	_, _, _, _, _, err = fd.Write(ctx, buf, 0, block, data.DirEntry{}, df)
	if err != nil {
		return err
	}

	// There might be a new top block.
	topBlock, err := dirtyBcache.Get(ctx, fup.id(), ptr, fup.branch())
	if err != nil {
		return err
	}
	block, ok := topBlock.(*data.FileBlock)
	if !ok {
		return errors.New("Top block change block no longer a file block")
	}

	// Ready all the child blocks.
	infos, err := fd.Ready(ctx, fup.id(), fup.config.BlockCache(),
		dirtyBcache, fup.config.BlockOps(), bps, block, df)
	if err != nil {
		return err
	}
	for info := range infos {
		md.AddMDRefBytes(uint64(info.EncodedSize))
		md.AddMDDiskUsage(uint64(info.EncodedSize))
	}
	fup.vlog.CLogf(ctx, libkb.VLog1, "%d unembedded child blocks", len(infos))

	// Ready the top block.
	info, _, err := fup.readyBlockMultiple(
		ctx, md.ReadOnly(), block, chargedTo, bps, keybase1.BlockType_MD)
	if err != nil {
		return err
	}

	md.AddMDRefBytes(uint64(info.EncodedSize))
	md.AddMDDiskUsage(uint64(info.EncodedSize))
	md.data.cachedChanges = *changes
	changes.Info = info
	changes.Ops = nil
	return nil
}

type isDirtyWithDBM struct {
	dbm         dirBlockMap
	dirtyBcache data.DirtyBlockCache
}

func (idwl isDirtyWithDBM) IsDirty(
	tlfID tlf.ID, ptr data.BlockPointer, branch data.BranchName) bool {
	hasBlock, err := idwl.dbm.hasBlock(context.Background(), ptr)
	if err != nil {
		// TODO: do something with this error.
		return false
	}
	if hasBlock {
		return true
	}

	return idwl.dirtyBcache.IsDirty(tlfID, ptr, branch)
}

// prepUpdateForPath updates, and readies, the blocks along the path
// for the given write, up to the root of the tree or stopAt (if
// specified).  When it updates the root of the tree, it also modifies
// the given head object with a new revision number and root block ID.
// It first checks the provided dbm for blocks that may have been
// modified by previous prepUpdateForPath calls or the FS calls
// themselves.  It returns the updated path to the changed directory,
// the new or updated directory entry created as part of the call, and
// a summary of all the blocks that now must be put to the block
// server.
//
// This function is safe to use unlocked, but may modify MD to have
// the same revision number as another one. Callers that require
// serialized revision numbers must implement their own locking around
// their instance.
//
// entryType must not be Sym.
//
// TODO: deal with multiple nodes for indirect blocks
func (fup *folderUpdatePrepper) prepUpdateForPath(
	ctx context.Context, lState *kbfssync.LockState,
	chargedTo keybase1.UserOrTeamID, md *RootMetadata, newBlock data.Block,
	newBlockPtr data.BlockPointer, dir data.Path, name data.PathPartString,
	entryType data.EntryType, mtime bool, ctime bool, stopAt data.BlockPointer,
	dbm dirBlockMap, bps blockPutState) (data.Path, data.DirEntry, error) {
	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	var currDD *data.DirData
	var currDDPtr data.BlockPointer
	var cleanupFn func()
	defer func() {
		if cleanupFn != nil {
			cleanupFn()
		}
	}()
	if _, isDir := newBlock.(*data.DirBlock); isDir {
		newPath := dir.ChildPath(
			name, newBlockPtr, fup.blocks.nodeCache.ObfuscatorMaker()())
		currDD, cleanupFn = fup.blocks.newDirDataWithDBM(
			lState, newPath, chargedTo, md, dbm)
		currDDPtr = newPath.TailPointer()
	}
	currName := name
	newPath := data.Path{
		FolderBranch: dir.FolderBranch,
		Path:         make([]data.PathNode, 0, len(dir.Path)),
	}
	var newDe data.DirEntry
	doSetTime := true
	now := fup.nowUnixNano()
	var uid keybase1.UID
	for len(newPath.Path) < len(dir.Path)+1 {
		if currDD != nil {
			// Ready any non-top blocks in the directory.
			newInfos, err := currDD.Ready(
				ctx, fup.id(), fup.config.BlockCache(),
				isDirtyWithDBM{dbm, fup.config.DirtyBlockCache()},
				fup.config.BlockOps(), bps, currBlock.(*data.DirBlock))
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
			for newInfo := range newInfos {
				md.AddRefBlock(newInfo)
			}

			dirUnrefs := fup.blocks.getDirtyDirUnrefsLocked(
				lState, currDDPtr)
			for _, unref := range dirUnrefs {
				md.AddUnrefBlock(unref)
			}
			cleanupFn()
			cleanupFn = nil
		}

		info, plainSize, err := fup.readyBlockMultiple(
			ctx, md.ReadOnly(), currBlock, chargedTo, bps,
			fup.config.DefaultBlockType())
		if err != nil {
			return data.Path{}, data.DirEntry{}, err
		}
		if dblock, ok := currBlock.(*data.DirBlock); ok {
			plainSize = dblock.TotalPlainSizeEstimate(
				plainSize, fup.config.BlockSplitter())
		}

		// prepend to path and setup next one
		newPath.Path = append([]data.PathNode{
			{BlockPointer: info.BlockPointer, Name: currName}},
			newPath.Path...)

		// get the parent block
		prevIdx := len(dir.Path) - len(newPath.Path)
		var de data.DirEntry
		var nextName data.PathPartString
		nextDoSetTime := false
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = md.data.Dir
		} else {
			prevDir := data.Path{
				FolderBranch: dir.FolderBranch,
				Path:         dir.Path[:prevIdx+1],
			}

			var dd *data.DirData
			dd, cleanupFn = fup.blocks.newDirDataWithDBM(
				lState, prevDir, chargedTo, md, dbm)
			de, err = dd.Lookup(ctx, currName)
			if _, noExists := errors.Cause(err).(idutil.NoSuchNameError); noExists {
				// If this isn't the first time
				// around, we have an error.
				if len(newPath.Path) > 1 {
					return data.Path{}, data.DirEntry{},
						idutil.NoSuchNameError{Name: currName.String()}
				}

				// If this is a file, the size should be 0. (TODO:
				// Ensure this.) If this is a directory, the size will
				// be filled in below.  The times will be filled in
				// below as well, since we should only be creating a
				// new directory entry when doSetTime is true.
				de = data.DirEntry{
					EntryInfo: data.EntryInfo{
						Type: entryType,
						Size: 0,
					},
				}
				// If we're creating a new directory entry, the
				// parent's times must be set as well.
				nextDoSetTime = true
			} else if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}

			prevDblock, err := dd.GetTopBlock(ctx, data.BlockWrite)
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
			currBlock = prevDblock
			currDD = dd
			currDDPtr = prevDir.TailPointer()
			nextName = prevDir.TailName()
		}

		if de.Type == data.Dir {
			de.Size = uint64(plainSize)
		}

		if prevIdx < 0 {
			md.AddUpdate(md.data.Dir.BlockInfo, info)
			err = bps.SaveOldPtr(ctx, md.data.Dir.BlockPointer)
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
		} else if prevDe, err := currDD.Lookup(ctx, currName); err == nil {
			md.AddUpdate(prevDe.BlockInfo, info)
			err = bps.SaveOldPtr(ctx, prevDe.BlockPointer)
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
		} else {
			// this is a new block
			md.AddRefBlock(info)
		}

		de.BlockInfo = info
		de.PrevRevisions = de.PrevRevisions.AddRevision(
			md.Revision(), md.data.LastGCRevision)

		if doSetTime {
			if mtime {
				de.Mtime = now
			}
			if ctime {
				de.Ctime = now
			}
		}

		if fup.id().Type() == tlf.SingleTeam {
			if uid.IsNil() {
				session, err := fup.config.KBPKI().GetCurrentSession(ctx)
				if err != nil {
					return data.Path{}, data.DirEntry{}, err
				}
				uid = session.UID
			}
			de.TeamWriter = uid
		}

		if !newDe.IsInitialized() {
			newDe = de
		}

		if prevIdx < 0 {
			md.data.Dir = de
		} else {
			unrefs, err := currDD.SetEntry(ctx, currName, de)
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
			for _, unref := range unrefs {
				md.AddUnrefBlock(unref)
			}
			// Fetch the current block again, since `setEntry` might
			// not modify the original `currBlock`, but some
			// re-assembled version if the disk cache is in use.
			currBlock, err = dbm.getBlock(ctx, currDDPtr)
			if err != nil {
				return data.Path{}, data.DirEntry{}, err
			}
		}
		currName = nextName

		// Stop before we get to the common ancestor; it will be taken care of
		// on the next sync call
		if prevIdx >= 0 && dir.Path[prevIdx].BlockPointer == stopAt {
			break
		}
		doSetTime = nextDoSetTime
	}

	return newPath, newDe, nil
}

// pathTreeNode represents a particular node in the part of the FS
// tree affected by a set of updates which needs to be sync'd.
type pathTreeNode struct {
	ptr        data.BlockPointer
	parent     *pathTreeNode
	children   map[string]*pathTreeNode
	mergedPath data.Path
}

type prepFolderCopyBehavior int

const (
	prepFolderCopyIndirectFileBlocks     prepFolderCopyBehavior = 1
	prepFolderDontCopyIndirectFileBlocks prepFolderCopyBehavior = 2
)

// prepTree, given a node in part of the FS tree that needs to be
// sync'd, either calls prepUpdateForPath on it if the node has no
// children of its own, or it calls prepTree recursively for all
// children.  When calling itself recursively on its children, it
// instructs each child to sync only up to this node, except for the
// last child which may sync back to the given stopAt pointer.  This
// ensures that the sync process will ready blocks that are complete
// (with all child changes applied) before readying any parent blocks.
// prepTree returns the merged blockPutState for itself and all of its
// children.
func (fup *folderUpdatePrepper) prepTree(
	ctx context.Context, lState *kbfssync.LockState, unmergedChains *crChains,
	newMD *RootMetadata, chargedTo keybase1.UserOrTeamID, node *pathTreeNode,
	stopAt data.BlockPointer, dbm dirBlockMap, newFileBlocks fileBlockMap,
	dirtyBcache data.DirtyBlockCacheSimple, bps blockPutState,
	copyBehavior prepFolderCopyBehavior) error {
	// If this has no children, then sync it, as far back as stopAt.
	if len(node.children) == 0 {
		// Look for the directory block or the new file block.
		entryType := data.Dir
		hasDirBlock, err := dbm.hasBlock(ctx, node.ptr)
		if err != nil {
			return err
		}
		// non-nil exactly when entryType != Dir.
		var block data.Block
		var fblock *data.FileBlock
		if hasDirBlock {
			dirBlock, err := dbm.getBlock(ctx, node.ptr)
			if err != nil {
				return err
			}
			block = dirBlock
		} else {
			// This must be a file, so look it up in the parent
			if node.parent == nil {
				return fmt.Errorf("No parent found for node %v while "+
					"syncing path %v", node.ptr, node.mergedPath.Path)
			}

			var err error
			fblock, err = newFileBlocks.GetTopBlock(
				ctx, node.parent.ptr, node.mergedPath.TailName().Plaintext())
			if err != nil {
				return err
			}
			block = fblock
			entryType = data.File // TODO: FIXME for Ex and Sym
		}

		// For an indirect file block, make sure a new
		// reference is made for every child block.
		if copyBehavior == prepFolderCopyIndirectFileBlocks &&
			entryType != data.Dir && fblock.IsInd {
			var infos []data.BlockInfo
			var err error

			// If journaling is enabled, new references aren't
			// supported.  We have to fetch each block and ready
			// it.  TODO: remove this when KBFS-1149 is fixed.
			if TLFJournalEnabled(fup.config, fup.id()) {
				infos, err = fup.blocks.UndupChildrenInCopy(
					ctx, lState, newMD.ReadOnly(), node.mergedPath, bps,
					dirtyBcache, fblock)
				if err != nil {
					return err
				}
			} else {
				// Ready any mid-level internal children.
				_, err = fup.blocks.ReadyNonLeafBlocksInCopy(
					ctx, lState, newMD.ReadOnly(), node.mergedPath, bps,
					dirtyBcache, fblock)
				if err != nil {
					return err
				}

				infos, err = fup.blocks.
					GetIndirectFileBlockInfosWithTopBlock(
						ctx, lState, newMD.ReadOnly(), node.mergedPath, fblock)
				if err != nil {
					return err
				}

				for _, info := range infos {
					// The indirect blocks were already added to
					// childBps, so only add the dedup'd leaf blocks.
					if info.RefNonce != kbfsblock.ZeroRefNonce {
						err = bps.AddNewBlock(
							ctx, info.BlockPointer, nil, data.ReadyBlockData{}, nil)
						if err != nil {
							return err
						}
					}
				}
			}
			for _, info := range infos {
				newMD.AddRefBlock(info)
			}
		}

		// Assume the mtime/ctime are already fixed up in the blocks
		// in the dbm.
		_, _, err = fup.prepUpdateForPath(
			ctx, lState, chargedTo, newMD, block, node.ptr,
			*node.mergedPath.ParentPath(), node.mergedPath.TailName(),
			entryType, false, false, stopAt, dbm, bps)
		if err != nil {
			return err
		}

		return nil
	}

	// If there is more than one child, use this node as the stopAt
	// since it is the branch point, except for the last child.
	count := 0
	for _, child := range node.children {
		localStopAt := node.ptr
		count++
		if count == len(node.children) {
			localStopAt = stopAt
		}
		err := fup.prepTree(
			ctx, lState, unmergedChains, newMD, chargedTo, child, localStopAt,
			dbm, newFileBlocks, dirtyBcache, bps, copyBehavior)
		if err != nil {
			return err
		}
	}
	return nil
}

// updateResolutionUsageLockedCache figures out how many bytes are
// referenced and unreferenced in the merged branch by this
// resolution.  Only needs to be called for non-squash resolutions.
// `fup.cacheLock` must be taken before calling.
func (fup *folderUpdatePrepper) updateResolutionUsageLockedCache(
	ctx context.Context, lState *kbfssync.LockState, md *RootMetadata,
	bps blockPutState, unmergedChains, mergedChains *crChains,
	mostRecentMergedMD ImmutableRootMetadata,
	refs, unrefs map[data.BlockPointer]bool) error {
	md.SetRefBytes(0)
	md.SetUnrefBytes(0)
	md.SetMDRefBytes(0)
	md.SetDiskUsage(mostRecentMergedMD.DiskUsage())
	md.SetMDDiskUsage(mostRecentMergedMD.MDDiskUsage())

	localBlocks := make(map[data.BlockPointer]data.Block)
	for _, ptr := range bps.Ptrs() {
		if block, err := bps.GetBlock(ctx, ptr); err == nil && block != nil {
			localBlocks[ptr] = block
		}
	}

	// Add bytes for every ref'd block.
	refPtrsToFetch := make([]data.BlockPointer, 0, len(refs))
	var refSum uint64
	for ptr := range refs {
		if block, ok := localBlocks[ptr]; ok {
			refSum += uint64(block.GetEncodedSize())
		} else {
			refPtrsToFetch = append(refPtrsToFetch, ptr)
		}
		fup.vlog.CLogf(ctx, libkb.VLog1, "Ref'ing block %v", ptr)
	}

	// Look up the total sum of the ref blocks in parallel to get
	// their sizes.
	//
	// TODO: If the blocks weren't already in the cache, this call
	// won't cache them, so it's kind of wasting work.  Furthermore,
	// we might be able to get the encoded size from other sources as
	// well (such as its directory entry or its indirect file block)
	// if we happened to have come across it before.
	refSumFetched, err := fup.blocks.GetCleanEncodedBlocksSizeSum(
		ctx, lState, md.ReadOnly(), refPtrsToFetch, nil, fup.branch(), false)
	if err != nil {
		return err
	}
	refSum += refSumFetched

	fup.vlog.CLogf(ctx, libkb.VLog1, "Ref'ing a total of %d bytes", refSum)
	md.AddRefBytes(refSum)
	md.AddDiskUsage(refSum)

	unrefPtrsToFetch := make([]data.BlockPointer, 0, len(unrefs))
	var unrefSum uint64
	for ptr := range unrefs {
		original, ok := unmergedChains.originals[ptr]
		if !ok {
			original = ptr
		}
		if original != ptr || unmergedChains.isCreated(original) {
			// Only unref pointers that weren't created as part of the
			// unmerged branch.  Either they existed already or they
			// were created as part of the merged branch.
			continue
		}
		// Also make sure this wasn't already removed or overwritten
		// on the merged branch.
		original, ok = mergedChains.originals[ptr]
		if !ok {
			original = ptr
		}
		mergedChain, ok := mergedChains.byOriginal[original]
		if (ok && original != mergedChain.mostRecent && original == ptr) ||
			mergedChains.isDeleted(original) {
			continue
		}

		if info, ok := fup.cachedInfos[ptr]; ok {
			unrefSum += uint64(info.EncodedSize)
		} else {
			unrefPtrsToFetch = append(unrefPtrsToFetch, ptr)
		}
	}

	// Look up the unref blocks in parallel to get their sizes.  Since
	// we don't know whether these are files or directories, just look
	// them up generically.  Ignore any recoverable errors for unrefs.
	// Note that we can't combine these with the above ref fetches
	// since they require a different MD.  If the merged changes
	// didn't change any blocks (in particular, the root block), we
	// can assume all the blocks we are unreferencing were live;
	// otherwise, we need to check with the server to make sure.
	onlyCountIfLive := len(mergedChains.byOriginal) != 0
	unrefSumFetched, err := fup.blocks.GetCleanEncodedBlocksSizeSum(
		ctx, lState, mostRecentMergedMD, unrefPtrsToFetch, unrefs,
		fup.branch(), onlyCountIfLive)
	if err != nil {
		return err
	}
	unrefSum += unrefSumFetched

	// Subtract bytes for every unref'd block that wasn't created in
	// the unmerged branch.
	fup.vlog.CLogf(ctx, libkb.VLog1, "Unref'ing a total of %d bytes", unrefSum)
	md.AddUnrefBytes(unrefSum)
	md.SetDiskUsage(md.DiskUsage() - unrefSum)
	return nil
}

// addUnrefToFinalResOp makes a resolutionOp at the end of opsList if
// one doesn't exist yet, and then adds the given pointer as an unref
// block to it.
func addUnrefToFinalResOp(ops opsList, ptr data.BlockPointer,
	doNotUnref map[data.BlockPointer]bool) opsList {
	// Make sure the block ID we want to unref isn't in the "do not
	// unref" list -- it could mean that block has already been GC'd
	// by the merged branch.  We can't compare pointers directly
	// because GC'd pointers contain no block context.
	for noUnref := range doNotUnref {
		if ptr.ID == noUnref.ID {
			return ops
		}
	}

	resOp, ok := ops[len(ops)-1].(*resolutionOp)
	if !ok {
		resOp = newResolutionOp()
		ops = append(ops, resOp)
	}
	resOp.AddUncommittedUnrefBlock(ptr)
	return ops
}

// updateResolutionUsageAndPointersLockedCache figures out how many
// bytes are referenced and unreferenced in the merged branch by this
// resolution (if needed), and adds referenced and unreferenced
// pointers to a final `resolutionOp` as necessary. It should be
// called before the block changes are unembedded in md.  It returns
// the list of blocks that can be remove from the flushing queue, if
// any.  `fup.cacheLock` must be taken before calling.
func (fup *folderUpdatePrepper) updateResolutionUsageAndPointersLockedCache(
	ctx context.Context, lState *kbfssync.LockState, md *RootMetadata,
	bps blockPutState, unmergedChains, mergedChains *crChains,
	mostRecentUnmergedMD, mostRecentMergedMD ImmutableRootMetadata,
	isLocalSquash bool) (
	blocksToDelete []kbfsblock.ID, err error) {

	// Track the refs and unrefs in a set, to ensure no duplicates
	refs := make(map[data.BlockPointer]bool)
	unrefs := make(map[data.BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		// Iterate in reverse since we may be deleting references as we go.
		for i := len(op.Refs()) - 1; i >= 0; i-- {
			ptr := op.Refs()[i]
			// Don't add usage if it's an unembedded block change
			// pointer.  Also, we shouldn't be referencing this
			// anymore!
			if unmergedChains.blockChangePointers[ptr] {
				fup.vlog.CLogf(
					ctx, libkb.VLog1, "Ignoring block change ptr %v", ptr)
				op.DelRefBlock(ptr)
			} else {
				refs[ptr] = true
			}
		}
		// Iterate in reverse since we may be deleting unrefs as we go.
		for i := len(op.Unrefs()) - 1; i >= 0; i-- {
			ptr := op.Unrefs()[i]
			unrefs[ptr] = true
			delete(refs, ptr)
			if _, isCreateOp := op.(*createOp); isCreateOp {
				// The only way a create op should have unref blocks
				// is if it was created during conflict resolution.
				// In that case, we should move the unref to a final
				// resolution op, so it doesn't confuse future
				// resolutions.
				op.DelUnrefBlock(ptr)
				md.data.Changes.Ops =
					addUnrefToFinalResOp(
						md.data.Changes.Ops, ptr, unmergedChains.doNotUnrefPointers)
			}
		}
		for _, update := range op.allUpdates() {
			if update.Unref != update.Ref {
				unrefs[update.Unref] = true
				delete(refs, update.Unref)
				refs[update.Ref] = true
			}
		}
	}

	for _, resOp := range unmergedChains.resOps {
		for _, ptr := range resOp.CommittedUnrefs() {
			original, err := unmergedChains.originalFromMostRecentOrSame(ptr)
			if err != nil {
				return nil, err
			}
			if !unmergedChains.isCreated(original) {
				fup.vlog.CLogf(
					ctx, libkb.VLog1, "Unref'ing %v from old resOp", ptr)
				unrefs[ptr] = true
			}
		}
	}

	// Unreference (and decrement the size) of any to-unref blocks
	// that weren't created in the unmerged branch.  (Example: non-top
	// dir blocks that were changed during the CR process.)
	for ptr := range unmergedChains.toUnrefPointers {
		original, err := unmergedChains.originalFromMostRecentOrSame(ptr)
		if err != nil {
			return nil, err
		}
		if !unmergedChains.isCreated(original) {
			unrefs[ptr] = true
		}
	}

	if isLocalSquash {
		// Collect any references made in previous resolution ops that
		// are being squashed together. These must be re-referenced in
		// the MD object to survive the squash.
		resToRef := make(map[data.BlockPointer]bool)
		for _, resOp := range unmergedChains.resOps {
			for _, ptr := range resOp.Refs() {
				if !unrefs[ptr] {
					resToRef[ptr] = true
				}
			}
			for _, ptr := range resOp.Unrefs() {
				delete(resToRef, ptr)
			}
			for _, update := range resOp.allUpdates() {
				delete(resToRef, update.Unref)
			}
		}
		for ptr := range resToRef {
			fup.vlog.CLogf(ctx, libkb.VLog1, "Ref'ing %v from old resOp", ptr)
			refs[ptr] = true
			md.data.Changes.Ops[0].AddRefBlock(ptr)
		}

		unmergedUsage := mostRecentUnmergedMD.DiskUsage()
		mergedUsage := mostRecentMergedMD.DiskUsage()

		// Local squashes can just use the bytes and usage from the
		// latest unmerged MD, and we can avoid all the block fetching
		// done by `updateResolutionUsage()`.
		md.SetDiskUsage(unmergedUsage)
		// TODO: it might be better to add up all the ref bytes, and
		// all the unref bytes, from all unmerged MDs, instead of just
		// calculating the difference between the usages.  But that's
		// not quite right either since it counts blocks that are
		// ref'd and unref'd within the squash.
		if md.DiskUsage() > mergedUsage {
			md.SetRefBytes(md.DiskUsage() - mergedUsage)
			md.SetUnrefBytes(0)
		} else {
			md.SetRefBytes(0)
			md.SetUnrefBytes(mergedUsage - md.DiskUsage())
		}

		mergedMDUsage := mostRecentMergedMD.MDDiskUsage()
		if md.MDDiskUsage() < mergedMDUsage {
			return nil, fmt.Errorf("MD disk usage went down on unmerged "+
				"branch: %d vs %d", md.MDDiskUsage(), mergedMDUsage)
		}

		// Additional MD disk usage will be determined entirely by the
		// later `unembedBlockChanges()` call.
		md.SetMDDiskUsage(mergedMDUsage)
		md.SetMDRefBytes(0)
	} else {
		err = fup.updateResolutionUsageLockedCache(
			ctx, lState, md, bps, unmergedChains, mergedChains,
			mostRecentMergedMD, refs, unrefs)
		if err != nil {
			return nil, err
		}
	}

	// Any blocks that were created on the unmerged branch and have
	// been flushed, but didn't survive the resolution, should be
	// marked as unreferenced in the resolution.
	toUnref := make(map[data.BlockPointer]bool)
	for ptr := range unmergedChains.originals {
		if !refs[ptr] && !unrefs[ptr] {
			toUnref[ptr] = true
		}
	}
	for ptr := range unmergedChains.createdOriginals {
		if !refs[ptr] && !unrefs[ptr] && unmergedChains.byOriginal[ptr] != nil {
			toUnref[ptr] = true
		} else if unmergedChains.blockChangePointers[ptr] {
			toUnref[ptr] = true
		}
	}
	for ptr := range unmergedChains.toUnrefPointers {
		toUnref[ptr] = true
	}
	for _, resOp := range unmergedChains.resOps {
		for _, ptr := range resOp.Refs() {
			if !isLocalSquash && !refs[ptr] && !unrefs[ptr] {
				toUnref[ptr] = true
			}
		}
		for _, ptr := range resOp.Unrefs() {
			if !refs[ptr] && !unrefs[ptr] {
				toUnref[ptr] = true
			}
		}
	}
	deletedRefs := make(map[data.BlockPointer]bool)
	deletedUnrefs := make(map[data.BlockPointer]bool)
	for ptr := range toUnref {
		if ptr == data.ZeroPtr || unmergedChains.doNotUnrefPointers[ptr] {
			// A zero pointer can sneak in from the unrefs field of a
			// syncOp following a failed syncOp, via
			// `unmergedChains.toUnrefPointers` after a chain collapse.
			continue
		}
		isUnflushed, err := fup.config.BlockServer().IsUnflushed(
			ctx, fup.id(), ptr.ID)
		if err != nil {
			return nil, err
		}
		if isUnflushed {
			blocksToDelete = append(blocksToDelete, ptr.ID)
			deletedUnrefs[ptr] = true
			// No need to unreference this since we haven't flushed it yet.
			continue
		}

		deletedRefs[ptr] = true
		// Put the unrefs in a new resOp after the final operation, to
		// cancel out any stray refs in earlier ops.
		fup.vlog.CLogf(ctx, libkb.VLog1, "Unreferencing dropped block %v", ptr)
		md.data.Changes.Ops = addUnrefToFinalResOp(
			md.data.Changes.Ops, ptr, unmergedChains.doNotUnrefPointers)
	}

	// Scrub all refs and unrefs of blocks that never made it to the
	// server, for smaller updates and to make things easier on the
	// StateChecker.  We scrub the refs too because in some cases
	// (e.g., on a copied conflict file), we add an unref without
	// removing the original ref, and if we remove the unref, the ref
	// must go too.
	if len(deletedRefs) > 0 || len(deletedUnrefs) > 0 {
		for _, op := range md.data.Changes.Ops {
			var toDelRef []data.BlockPointer
			for _, ref := range op.Refs() {
				if deletedRefs[ref] || deletedUnrefs[ref] {
					toDelRef = append(toDelRef, ref)
				}
			}
			for _, ref := range toDelRef {
				fup.vlog.CLogf(ctx, libkb.VLog1, "Scrubbing ref %v", ref)
				op.DelRefBlock(ref)
			}
			var toDelUnref []data.BlockPointer
			for _, unref := range op.Unrefs() {
				if deletedUnrefs[unref] {
					toDelUnref = append(toDelUnref, unref)
				}
			}
			for _, unref := range toDelUnref {
				fup.vlog.CLogf(ctx, libkb.VLog1, "Scrubbing unref %v", unref)
				op.DelUnrefBlock(unref)
			}
		}
		for _, resOp := range unmergedChains.resOps {
			for _, unref := range resOp.Unrefs() {
				if deletedUnrefs[unref] {
					fup.vlog.CLogf(
						ctx, libkb.VLog1, "Scrubbing resOp unref %v", unref)
					resOp.DelUnrefBlock(unref)
				}
			}
		}
	}

	fup.log.CDebugf(ctx, "New md byte usage: %d ref, %d unref, %d total usage "+
		"(previously %d)", md.RefBytes(), md.UnrefBytes(), md.DiskUsage(),
		mostRecentMergedMD.DiskUsage())
	return blocksToDelete, nil
}

func (fup *folderUpdatePrepper) setChildrenNodes(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	p data.Path, indexInPath int, dbm dirBlockMap, nextNode *pathTreeNode,
	currPath data.Path, names []string) {
	dd, cleanupFn := fup.blocks.newDirDataWithDBM(
		lState, currPath, keybase1.UserOrTeamID(""), kmd, dbm)
	defer cleanupFn()

	pnode := p.Path[indexInPath]
	for _, namePlain := range names {
		if _, ok := nextNode.children[namePlain]; ok {
			continue
		}
		// Try to lookup the block pointer, but this might be
		// for a new file.
		var filePtr data.BlockPointer
		name := data.NewPathPartString(namePlain, currPath.Obfuscator())
		de, err := dd.Lookup(ctx, name)
		switch errors.Cause(err).(type) {
		case nil:
			filePtr = de.BlockPointer
		case idutil.NoSuchNameError:
		default:
			fup.log.CWarningf(ctx, "Couldn't look up child: %+v", err)
			continue
		}

		fup.vlog.CLogf(
			ctx, libkb.VLog1, "Creating child node for name %s for parent %v",
			name, pnode.BlockPointer)
		childPath := data.Path{
			FolderBranch: p.FolderBranch,
			Path:         make([]data.PathNode, indexInPath+2),
		}
		copy(childPath.Path[0:indexInPath+1], p.Path[0:indexInPath+1])
		childPath.Path[indexInPath+1] = data.PathNode{Name: name}
		childNode := &pathTreeNode{
			ptr:        filePtr,
			parent:     nextNode,
			children:   make(map[string]*pathTreeNode),
			mergedPath: childPath,
		}
		nextNode.children[namePlain] = childNode
	}
}

func (fup *folderUpdatePrepper) makeSyncTree(
	ctx context.Context, lState *kbfssync.LockState,
	resolvedPaths map[data.BlockPointer]data.Path, kmd libkey.KeyMetadata, dbm dirBlockMap,
	newFileBlocks fileBlockMap) *pathTreeNode {
	var root *pathTreeNode
	var cleanupFn func()
	defer func() {
		if cleanupFn != nil {
			cleanupFn()
		}
	}()
	for _, p := range resolvedPaths {
		fup.vlog.CLogf(
			ctx, libkb.VLog1, "Creating tree from merged path: %v", p.Path)
		var parent *pathTreeNode
		for i, pnode := range p.Path {
			var nextNode *pathTreeNode
			if parent != nil {
				nextNode = parent.children[pnode.Name.Plaintext()]
			} else if root != nil {
				nextNode = root
			}
			if nextNode == nil {
				fup.vlog.CLogf(
					ctx, libkb.VLog1, "Creating node with pointer %v",
					pnode.BlockPointer)
				nextNode = &pathTreeNode{
					ptr:      pnode.BlockPointer,
					parent:   parent,
					children: make(map[string]*pathTreeNode),
					// save the full path, since we'll only use this
					// at the leaves anyway.
					mergedPath: p,
				}
				if parent != nil {
					parent.children[pnode.Name.Plaintext()] = nextNode
				}
			}
			if parent == nil && root == nil {
				root = nextNode
			}
			parent = nextNode

			// If this node is a directory that has files to sync,
			// make nodes for them as well.  (Because of
			// collapseActions, these files won't have their own
			// mergedPath.)
			names, err := newFileBlocks.getFilenames(ctx, pnode.BlockPointer)
			if err != nil {
				fup.log.CDebugf(ctx, "Error getting file names: %+v", err)
				continue
			}
			if len(names) == 0 {
				continue
			}

			hasBlock, err := dbm.hasBlock(ctx, pnode.BlockPointer)
			if err != nil {
				fup.log.CDebugf(ctx, "Error getting dir block: %+v", err)
				continue
			}
			if !hasBlock {
				// If the top block of the dir hasn't been dirtied, we
				// can skip it completely.
				continue
			}
			var ob data.Obfuscator
			if i+1 < len(p.Path) {
				ob = p.Path[i+1].Name.Obfuscator()
			} else {
				ob = p.Obfuscator()
			}
			currPath := data.Path{
				FolderBranch:    p.FolderBranch,
				Path:            p.Path[:i+1],
				ChildObfuscator: ob,
			}
			fup.setChildrenNodes(
				ctx, lState, kmd, p, i, dbm, nextNode, currPath, names)
		}
	}
	return root
}

// fixOpPointersForUpdate takes in a slice of "reverted" ops (all referring
// to the original BlockPointers) and a map of BlockPointer updates
// (from original to the new most recent pointer), and corrects all
// the ops to use the new most recent pointers instead.  It returns a
// new slice of these operations with room in the first slot for a
// dummy operation containing all the updates.
func fixOpPointersForUpdate(oldOps []op, updates map[data.BlockPointer]data.BlockPointer,
	chains *crChains) (
	[]op, error) {
	newOps := make([]op, 0, len(oldOps)+1)
	newOps = append(newOps, nil) // placeholder for dummy op
	for _, op := range oldOps {
		var updatesToFix []*blockUpdate
		var ptrsToFix []*data.BlockPointer
		switch realOp := op.(type) {
		case *createOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			// Since the created node was made exclusively during this
			// branch, we can use the most recent pointer for that
			// node as its ref.
			refs := realOp.Refs()
			realOp.RefBlocks = make([]data.BlockPointer, len(refs))
			for i, ptr := range refs {
				mostRecent, err := chains.mostRecentFromOriginalOrSame(ptr)
				if err != nil {
					return nil, err
				}
				realOp.RefBlocks[i] = mostRecent
				ptrsToFix = append(ptrsToFix, &realOp.RefBlocks[i])
			}
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		case *rmOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			// Since the rm'd node was made exclusively during this
			// branch, we can use the original pointer for that
			// node as its unref.
			unrefs := realOp.Unrefs()
			realOp.UnrefBlocks = make([]data.BlockPointer, len(unrefs))
			for i, ptr := range unrefs {
				original, err := chains.originalFromMostRecentOrSame(ptr)
				if err != nil {
					return nil, err
				}
				realOp.UnrefBlocks[i] = original
			}
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		case *renameOp:
			updatesToFix = append(updatesToFix, &realOp.OldDir, &realOp.NewDir)
			ptrsToFix = append(ptrsToFix, &realOp.Renamed)
			// Hack: we need to fixup local conflict renames so that the block
			// update changes to the new block pointer.
			for i := range realOp.Updates {
				ptrsToFix = append(ptrsToFix, &realOp.Updates[i].Ref)
			}
			// Note: Unrefs from the original renameOp are now in a
			// separate rm operation.
		case *syncOp:
			updatesToFix = append(updatesToFix, &realOp.File)
			realOp.Updates = nil
		case *setAttrOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			ptrsToFix = append(ptrsToFix, &realOp.File)
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		}

		for _, update := range updatesToFix {
			newPtr, ok := updates[update.Unref]
			if !ok {
				continue
			}
			// Since the first op does all the heavy lifting of
			// updating pointers, we can set these to both just be the
			// new pointer
			var err error
			*update, err = makeBlockUpdate(newPtr, newPtr)
			if err != nil {
				return nil, err
			}
		}
		for _, ptr := range ptrsToFix {
			newPtr, ok := updates[*ptr]
			if !ok {
				continue
			}
			*ptr = newPtr
		}

		newOps = append(newOps, op)
	}
	return newOps, nil
}

// prepUpdateForPaths takes in the complete set of paths affected by a
// set of changes, and organizes them into a tree, which it then syncs
// using prepTree.  It returns a map describing how blocks were
// updated in the final update, as well as the complete set of blocks
// that need to be put to the server (and cached) to complete this
// update and a list of blocks that can be removed from the flushing
// queue.
func (fup *folderUpdatePrepper) prepUpdateForPaths(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata,
	unmergedChains, mergedChains *crChains,
	mostRecentUnmergedMD, mostRecentMergedMD ImmutableRootMetadata,
	resolvedPaths map[data.BlockPointer]data.Path, dbm dirBlockMap,
	newFileBlocks fileBlockMap, dirtyBcache data.DirtyBlockCacheSimple,
	bps blockPutState, copyBehavior prepFolderCopyBehavior) (
	updates map[data.BlockPointer]data.BlockPointer,
	blocksToDelete []kbfsblock.ID, err error) {
	updates = make(map[data.BlockPointer]data.BlockPointer)

	chargedTo, err := chargedToForTLF(
		ctx, fup.config.KBPKI(), fup.config.KBPKI(), fup.config,
		md.GetTlfHandle())
	if err != nil {
		return nil, nil, err
	}

	oldOps := md.data.Changes.Ops
	resOp, ok := oldOps[len(oldOps)-1].(*resolutionOp)
	if !ok {
		return nil, nil, fmt.Errorf("dummy op is not gc: %s",
			oldOps[len(oldOps)-1])
	}

	var mergedRoot data.BlockPointer
	if mergedChains.mostRecentChainMDInfo != nil {
		// This can happen when we are squashing and there weren't any
		// merged MD updates at all.
		mergedRoot =
			mergedChains.mostRecentChainMDInfo.GetRootDirEntry().BlockPointer
	}
	isSquash := mostRecentMergedMD.data.Dir.BlockPointer != mergedRoot

	if isSquash {
		// Squashes don't need to sync anything new.  Just set the
		// root pointer to the most recent root pointer, and fill up
		// the resolution op with all the known chain updates for this
		// branch.
		md.data.Dir.BlockInfo =
			unmergedChains.mostRecentChainMDInfo.GetRootDirEntry().BlockInfo
		for original, chain := range unmergedChains.byOriginal {
			if unmergedChains.isCreated(original) ||
				unmergedChains.isDeleted(original) ||
				chain.original == chain.mostRecent {
				continue
			}
			resOp.AddUpdate(original, chain.mostRecent)
		}
	} else {
		// Construct a tree out of the merged paths, and do a sync at each leaf.
		root := fup.makeSyncTree(
			ctx, lState, resolvedPaths, md, dbm, newFileBlocks)

		if root != nil {
			err = fup.prepTree(ctx, lState, unmergedChains,
				md, chargedTo, root, data.BlockPointer{}, dbm, newFileBlocks,
				dirtyBcache, bps, copyBehavior)
			if err != nil {
				return nil, nil, err
			}
		}
	}

	// Create an update map, and fix up the gc ops.
	for i, update := range resOp.Updates {
		fup.vlog.CLogf(
			ctx, libkb.VLog1, "resOp update: %v -> %v", update.Unref,
			update.Ref)
		// The unref should represent the most recent merged pointer
		// for the block.  However, the other ops will be using the
		// original pointer as the unref, so use that as the key.
		updates[update.Unref] = update.Ref
		if chain, ok := mergedChains.byMostRecent[update.Unref]; ok {
			updates[chain.original] = update.Ref
		}

		// Fix the gc updates to make sure they all unref the most
		// recent block pointer.  In cases where the two users create
		// the same directory independently, the update might
		// currently unref the unmerged most recent pointer.
		if chain, ok := unmergedChains.byMostRecent[update.Unref]; ok {
			// In case there was no merged chain above, map the
			// original to the ref again.
			updates[chain.original] = update.Ref

			mergedMostRecent, err :=
				mergedChains.mostRecentFromOriginalOrSame(chain.original)
			if err != nil {
				return nil, nil, err
			}
			fup.vlog.CLogf(
				ctx, libkb.VLog1, "Fixing resOp update from unmerged most "+
					"recent %v to merged most recent %v",
				update.Unref, mergedMostRecent)
			err = update.setUnref(mergedMostRecent)
			if err != nil {
				return nil, nil, err
			}
			resOp.Updates[i] = update
			updates[update.Unref] = update.Ref
		}
	}

	// Also add in file updates from sync operations, since the
	// resolutionOp may not include file-specific updates.  Start from
	// the end of the list, so we use the final sync op for each file.
	for i := len(oldOps) - 1; i >= 0; i-- {
		op := oldOps[i]
		so, ok := op.(*syncOp)
		if !ok {
			continue
		}
		if _, ok := updates[so.File.Unref]; !ok {
			fup.vlog.CLogf(
				ctx, libkb.VLog1, "Adding sync op update %v -> %v",
				so.File.Unref, so.File.Ref)
			updates[so.File.Unref] = so.File.Ref
			resOp.AddUpdate(so.File.Unref, so.File.Ref)
		}
	}

	// For all chains that were created only in the unmerged branch,
	// make sure we update all the pointers to their most recent
	// version.
	for original, chain := range unmergedChains.byOriginal {
		if !unmergedChains.isCreated(original) ||
			mergedChains.isCreated(original) {
			continue
		}
		if _, ok := updates[chain.original]; !ok {
			updates[chain.original] = chain.mostRecent
		}
	}

	// For all chains that were updated in both branches, make sure
	// the most recent unmerged pointer updates to the most recent
	// merged pointer.  Normally this would get fixed up in the resOp
	// loop above, but that will miss directories that were not
	// updated as part of the resolution.  (For example, if a file was
	// moved out of a directory in the merged branch, but an attr was
	// set on that file in the unmerged branch.)
	for unmergedOriginal := range unmergedChains.byOriginal {
		mergedChain, ok := mergedChains.byOriginal[unmergedOriginal]
		if !ok {
			continue
		}
		if _, ok := updates[unmergedOriginal]; !ok {
			updates[unmergedOriginal] = mergedChain.mostRecent
		}
	}

	// For all chains that were renamed only in the unmerged branch,
	// make sure we update all the pointers to their most recent
	// version.
	for original := range unmergedChains.renamedOriginals {
		mergedChain, ok := mergedChains.byOriginal[original]
		if !ok {
			continue
		}
		updates[original] = mergedChain.mostRecent
	}

	// Consolidate any chains of updates
	for k, v := range updates {
		if v2, ok := updates[v]; ok {
			updates[k] = v2
			delete(updates, v)
		}
	}

	newOps, err := fixOpPointersForUpdate(oldOps[:len(oldOps)-1], updates,
		unmergedChains)
	if err != nil {
		return nil, nil, err
	}

	// Clean up any gc updates that don't refer to blocks that exist
	// in the merged branch.
	var newUpdates []blockUpdate
	for _, update := range resOp.Updates {
		// Ignore it if it doesn't descend from an original block
		// pointer or one created in the merged branch.
		if _, ok := unmergedChains.originals[update.Unref]; !ok &&
			(unmergedChains.byOriginal[update.Unref] == nil ||
				unmergedChains.isCreated(update.Unref)) &&
			mergedChains.byMostRecent[update.Unref] == nil {
			fup.vlog.CLogf(
				ctx, libkb.VLog1,
				"Turning update from %v into just a ref for %v",
				update.Unref, update.Ref)
			resOp.AddRefBlock(update.Ref)
			continue
		}
		newUpdates = append(newUpdates, update)
	}
	resOp.Updates = newUpdates

	// Also include rmop unrefs for chains that were deleted in the
	// unmerged branch but not yet included in `newOps`, and not
	// re-created by some action in the merged branch.  These need to
	// be in the resolution for proper block accounting and
	// invalidation.
	rmOpUnrefs := make(map[data.BlockPointer]bool)
	for _, op := range newOps {
		if _, ok := op.(*rmOp); !ok {
			continue
		}
		for _, unref := range op.Unrefs() {
			rmOpUnrefs[unref] = true
		}
	}
	for original, chain := range unmergedChains.byOriginal {
		mergedChain := mergedChains.byOriginal[original]
		if chain.isFile() || !unmergedChains.isDeleted(original) ||
			mergedChains.isDeleted(original) ||
			(mergedChain != nil && len(mergedChain.ops) > 0) {
			continue
		}
		for _, op := range chain.ops {
			if _, ok := op.(*rmOp); !ok {
				continue
			}

			// TODO: We might need to include these rmOps in the
			// actual resolved MD, to send the proper invalidations
			// into the kernel before we rm the parent.
			for _, ptr := range op.Unrefs() {
				if unrefOrig, ok := unmergedChains.originals[ptr]; ok {
					ptr = unrefOrig
				}
				if rmOpUnrefs[ptr] {
					continue
				}

				newOps = addUnrefToFinalResOp(
					newOps, ptr, unmergedChains.doNotUnrefPointers)
			}
		}
	}

	if len(unmergedChains.resOps) > 0 {
		newBlocks := make(map[data.BlockPointer]bool)
		for _, ptr := range bps.Ptrs() {
			newBlocks[ptr] = true
		}

		// Look into the previous unmerged resolution ops and decide
		// which updates we want to keep.  We should only keep those
		// that correspond to uploaded blocks, or ones that are the
		// most recent block on a chain and haven't yet been involved
		// in an update during this resolution.  Unreference any
		// blocks that aren't the most recent blocks on their chains.
		currMDPtr := md.data.Dir.BlockPointer
		unmergedMDPtr :=
			unmergedChains.mostRecentChainMDInfo.GetRootDirEntry().BlockPointer
		for _, unmergedResOp := range unmergedChains.resOps {
			// Updates go in the first one.
			for _, update := range unmergedResOp.allUpdates() {
				chain, isMostRecent := unmergedChains.byMostRecent[update.Ref]
				isDeleted := false
				alreadyUpdated := false
				if isMostRecent {
					isDeleted = unmergedChains.isDeleted(chain.original) ||
						unmergedChains.toUnrefPointers[update.Ref]
					_, alreadyUpdated = updates[chain.original]
				}
				if newBlocks[update.Ref] ||
					(isMostRecent && !isDeleted && !alreadyUpdated) {
					fup.vlog.CLogf(
						ctx, libkb.VLog1, "Including update from old resOp: "+
							"%v -> %v", update.Unref, update.Ref)
					resOp.AddUpdate(update.Unref, update.Ref)

					if update.Unref == currMDPtr && update.Ref == unmergedMDPtr {
						// If the root block pointer didn't get
						// updated above, we may need to update it if
						// we're pulling in an updated root pointer
						// from a previous unmerged resolutionOp.
						fup.vlog.CLogf(
							ctx, libkb.VLog1, "Setting root blockpointer from "+
								"%v to %v based on unmerged update",
							currMDPtr, unmergedMDPtr)
						md.data.Dir.BlockInfo =
							unmergedChains.mostRecentChainMDInfo.
								GetRootDirEntry().BlockInfo
					}
				} else if !isMostRecent {
					fup.vlog.CLogf(
						ctx, libkb.VLog1, "Unrefing an update from old resOp: "+
							"%v (original=%v)", update.Ref, update.Unref)
					newOps = addUnrefToFinalResOp(
						newOps, update.Ref, unmergedChains.doNotUnrefPointers)
				}
			}
		}
	}

	newOps[0] = resOp // move the dummy ops to the front
	md.data.Changes.Ops = newOps

	for _, op := range newOps {
		fup.vlog.CLogf(
			ctx, libkb.VLog1, "remote op %s: refs: %v", op, op.Refs())
		fup.vlog.CLogf(
			ctx, libkb.VLog1, "remote op %s: unrefs: %v", op, op.Unrefs())
		for _, update := range op.allUpdates() {
			fup.vlog.CLogf(
				ctx, libkb.VLog1, "remote op %s: update: %v -> %v", op,
				update.Unref, update.Ref)
		}
	}

	fup.cacheLock.Lock()
	defer fup.cacheLock.Unlock()
	blocksToDelete, err = fup.updateResolutionUsageAndPointersLockedCache(
		ctx, lState, md, bps, unmergedChains, mergedChains,
		mostRecentUnmergedMD, mostRecentMergedMD, isSquash)
	if err != nil {
		return nil, nil, err
	}

	// Any refs (child block change pointers) and unrefs (dropped
	// unmerged block pointers) from previous resolutions go in a new
	// resolutionOp at the end, so we don't attempt to count any of
	// the bytes in the unref bytes count -- all of these pointers are
	// guaranteed to have been created purely within the unmerged
	// branch.
	if len(unmergedChains.resOps) > 0 {
		toDeleteMap := make(map[kbfsblock.ID]bool)
		for _, id := range blocksToDelete {
			toDeleteMap[id] = true
		}
		for _, unmergedResOp := range unmergedChains.resOps {
			for i := len(unmergedResOp.Refs()) - 1; i >= 0; i-- {
				ptr := unmergedResOp.Refs()[i]
				if unmergedChains.blockChangePointers[ptr] &&
					!toDeleteMap[ptr.ID] {
					fup.vlog.CLogf(
						ctx, libkb.VLog1, "Ignoring block change ptr %v", ptr)
					unmergedResOp.DelRefBlock(ptr)
					md.data.Changes.Ops =
						addUnrefToFinalResOp(md.data.Changes.Ops, ptr,
							unmergedChains.doNotUnrefPointers)
				}
			}
			for _, ptr := range unmergedResOp.Unrefs() {
				fup.vlog.CLogf(
					ctx, libkb.VLog1, "Unref pointer from old resOp: %v", ptr)
				original, err := unmergedChains.originalFromMostRecentOrSame(
					ptr)
				if err != nil {
					return nil, nil, err
				}
				if !unmergedChains.isCreated(original) {
					md.data.Changes.Ops = addUnrefToFinalResOp(
						md.data.Changes.Ops, ptr,
						unmergedChains.doNotUnrefPointers)
				}
			}
		}
	}

	// do the block changes need their own blocks?
	bsplit := fup.config.BlockSplitter()
	if !bsplit.ShouldEmbedData(md.data.Changes.SizeEstimate()) {
		// The child blocks should be referenced in the resolution op.
		_, ok := md.data.Changes.Ops[len(md.data.Changes.Ops)-1].(*resolutionOp)
		if !ok {
			// Append directly to the ops list, rather than use AddOp,
			// because the size estimate was already calculated.
			md.data.Changes.Ops = append(md.data.Changes.Ops, newResolutionOp())
		}

		err = fup.unembedBlockChanges(
			ctx, bps, md, &md.data.Changes, chargedTo)
		if err != nil {
			return nil, nil, err
		}
	}
	fup.cachedInfos = nil
	return updates, blocksToDelete, nil
}

// cacheBlockInfos stores the given block infos temporarily, until the
// next prepUpdateForPaths completes, as an optimization.
func (fup *folderUpdatePrepper) cacheBlockInfos(infos []data.BlockInfo) {
	fup.cacheLock.Lock()
	defer fup.cacheLock.Unlock()
	if fup.cachedInfos == nil {
		fup.cachedInfos = make(map[data.BlockPointer]data.BlockInfo)
	}
	for _, info := range infos {
		fup.cachedInfos[info.BlockPointer] = info
	}
}
