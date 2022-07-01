// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// StateChecker verifies that the server-side state for KBFS is
// consistent.  Useful mostly for testing because it isn't scalable
// and loads all the state in memory.
type StateChecker struct {
	config Config
	log    logger.Logger
}

// NewStateChecker returns a new StateChecker instance.
func NewStateChecker(config Config) *StateChecker {
	return &StateChecker{config, config.MakeLogger("")}
}

// findAllFileBlocks adds all file blocks found under this block to
// the blockSizes map, if the given path represents an indirect block.
func (sc *StateChecker) findAllFileBlocks(ctx context.Context,
	lState *kbfssync.LockState, ops *folderBranchOps, kmd libkey.KeyMetadata,
	file data.Path, blockSizes map[data.BlockPointer]uint32) error {
	infos, err := ops.blocks.GetIndirectFileBlockInfos(ctx, lState, kmd, file)
	if err != nil {
		return err
	}

	for _, info := range infos {
		blockSizes[info.BlockPointer] = info.EncodedSize
	}
	return nil
}

// findAllDirBlocks adds all dir blocks found under this block to the
// blockSizes map, if the given path represents an indirect block.
func (sc *StateChecker) findAllDirBlocks(ctx context.Context,
	lState *kbfssync.LockState, ops *folderBranchOps, kmd libkey.KeyMetadata,
	dir data.Path, blockSizes map[data.BlockPointer]uint32) error {
	infos, err := ops.blocks.GetIndirectDirBlockInfos(ctx, lState, kmd, dir)
	if err != nil {
		return err
	}

	for _, info := range infos {
		blockSizes[info.BlockPointer] = info.EncodedSize
	}
	return nil
}

// findAllBlocksInPath adds all blocks found within this directory to
// the blockSizes map, and then recursively checks all
// subdirectories.
func (sc *StateChecker) findAllBlocksInPath(ctx context.Context,
	lState *kbfssync.LockState, ops *folderBranchOps, kmd libkey.KeyMetadata,
	dir data.Path, blockSizes map[data.BlockPointer]uint32) error {
	children, err := ops.blocks.GetEntries(ctx, lState, kmd, dir)
	if err != nil {
		return err
	}

	err = sc.findAllDirBlocks(ctx, lState, ops, kmd, dir, blockSizes)
	if err != nil {
		return err
	}

	for name, de := range children {
		if de.Type == data.Sym {
			continue
		}

		blockSizes[de.BlockPointer] = de.EncodedSize
		p := dir.ChildPath(name, de.BlockPointer, ops.makeObfuscator())

		if de.Type == data.Dir {
			err := sc.findAllBlocksInPath(ctx, lState, ops, kmd, p, blockSizes)
			if err != nil {
				return err
			}
		} else {
			// If it's a file, check to see if it's indirect.
			err := sc.findAllFileBlocks(ctx, lState, ops, kmd, p, blockSizes)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (sc *StateChecker) getLastGCData(ctx context.Context,
	tlfID tlf.ID) (time.Time, kbfsmd.Revision) {
	config, ok := sc.config.(*ConfigLocal)
	if !ok {
		return time.Time{}, kbfsmd.RevisionUninitialized
	}

	var latestTime time.Time
	var latestRev kbfsmd.Revision
	for _, c := range *config.allKnownConfigsForTesting {
		ops := c.KBFSOps().(*KBFSOpsStandard).getOpsIfExists(
			context.Background(),
			data.FolderBranch{Tlf: tlfID, Branch: data.MasterBranch})
		if ops == nil {
			continue
		}
		rt, rev := ops.fbm.getLastQRData()
		if rt.After(latestTime) && rev > latestRev {
			latestTime = rt
			latestRev = rev
		}
	}
	if latestTime.IsZero() {
		return latestTime, latestRev
	}

	sc.log.CDebugf(ctx, "Last qr data for TLF %s: revTime=%s, rev=%d",
		tlfID, latestTime, latestRev)
	return latestTime.Add(
		-sc.config.Mode().QuotaReclamationMinUnrefAge()), latestRev
}

// CheckMergedState verifies that the state for the given tlf is
// consistent.
func (sc *StateChecker) CheckMergedState(ctx context.Context, tlfID tlf.ID) error {
	// Blow away MD cache so we don't have any lingering re-embedded
	// block changes (otherwise we won't be able to learn their sizes).
	sc.config.SetMDCache(NewMDCacheStandard(defaultMDCacheCapacity))

	// Fetch all the MD updates for this folder, and use the block
	// change lists to build up the set of currently referenced blocks.
	rmds, err := getMergedMDUpdates(ctx, sc.config, tlfID,
		kbfsmd.RevisionInitial, nil)
	if err != nil {
		return err
	}
	if len(rmds) == 0 {
		sc.log.CDebugf(ctx, "No state to check for folder %s", tlfID)
		return nil
	}

	lState := makeFBOLockState()

	// Re-embed block changes.
	kbfsOps, ok := sc.config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	fb := data.FolderBranch{Tlf: tlfID, Branch: data.MasterBranch}
	ops := kbfsOps.getOps(context.Background(), fb, FavoritesOpNoChange)
	lastGCRevisionTime, lastGCRev := sc.getLastGCData(ctx, tlfID)

	// Build the expected block list.
	expectedLiveBlocks := make(map[data.BlockPointer]bool)
	expectedRef := uint64(0)
	expectedMDRef := uint64(0)
	archivedBlocks := make(map[data.BlockPointer]bool)
	actualLiveBlocks := make(map[data.BlockPointer]uint32)

	// See what the last GC op revision is.  All unref'd pointers from
	// that revision or earlier should be deleted from the block
	// server.
	gcRevision := kbfsmd.RevisionUninitialized
	for _, rmd := range rmds {
		// Don't process copies.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}

		for _, op := range rmd.data.Changes.Ops {
			GCOp, ok := op.(*GCOp)
			if !ok {
				continue
			}
			gcRevision = GCOp.LatestRev
		}
	}

	for _, rmd := range rmds {
		// Don't process copies.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		// Unembedded block changes count towards the MD size.
		if info := rmd.data.cachedChanges.Info; info.BlockPointer != data.ZeroPtr {
			sc.log.CDebugf(ctx, "Unembedded block change: %v, %d",
				info.BlockPointer, info.EncodedSize)
			actualLiveBlocks[info.BlockPointer] = info.EncodedSize

			// Any child block change pointers?
			file := data.Path{
				FolderBranch: data.FolderBranch{
					Tlf: tlfID, Branch: data.MasterBranch},
				Path: []data.PathNode{{
					BlockPointer: info.BlockPointer,
					Name: data.NewPathPartString(fmt.Sprintf(
						"<MD with revision %d>", rmd.Revision()), nil),
				}}}
			err := sc.findAllFileBlocks(ctx, lState, ops, rmd.ReadOnly(),
				file, actualLiveBlocks)
			if err != nil {
				return err
			}
		}

		var hasGCOp bool
		updated := make(map[data.BlockPointer]bool)
		for _, op := range rmd.data.Changes.Ops {
			_, isGCOp := op.(*GCOp)
			hasGCOp = hasGCOp || isGCOp

			opRefs := make(map[data.BlockPointer]bool)
			for _, ptr := range op.Refs() {
				if ptr != data.ZeroPtr {
					expectedLiveBlocks[ptr] = true
					opRefs[ptr] = true
				}
			}
			if !isGCOp {
				for _, ptr := range op.Unrefs() {
					if updated[ptr] {
						return fmt.Errorf(
							"%s already updated in this revision %d",
							ptr, rmd.Revision())
					}
					delete(expectedLiveBlocks, ptr)
					if ptr != data.ZeroPtr {
						// If the revision has been garbage-collected,
						// or if the pointer has been referenced and
						// unreferenced within the same op (which
						// indicates a failed and retried sync), the
						// corresponding block should already be
						// cleaned up.
						if rmd.Revision() <= gcRevision || opRefs[ptr] {
							delete(archivedBlocks, ptr)
						} else {
							archivedBlocks[ptr] = true
						}
					}
				}
			}
			for _, update := range op.allUpdates() {
				if update.Ref != update.Unref {
					updated[update.Unref] = true
					delete(expectedLiveBlocks, update.Unref)
				}
				if update.Unref != data.ZeroPtr && update.Ref != update.Unref {
					if rmd.Revision() <= gcRevision {
						delete(archivedBlocks, update.Unref)
					} else {
						archivedBlocks[update.Unref] = true
					}
				}
				if update.Ref != data.ZeroPtr && update.Ref != update.Unref {
					expectedLiveBlocks[update.Ref] = true
				}
			}
		}
		expectedRef += rmd.RefBytes()
		expectedRef -= rmd.UnrefBytes()
		expectedMDRef += rmd.MDRefBytes()

		if len(rmd.data.Changes.Ops) == 1 && hasGCOp {
			// Don't check GC status for GC revisions
			continue
		}

		// Make sure that if this revision should be covered by a GC
		// op, it is.  Note that this assumes that if QR is ever run,
		// it will be run completely and not left partially done due
		// to there being too many pointers to collect in one sweep.
		mtime := time.Unix(0, rmd.data.Dir.Mtime)
		if !lastGCRevisionTime.Before(mtime) && rmd.Revision() <= lastGCRev &&
			rmd.Revision() > gcRevision {
			return fmt.Errorf("Revision %d happened on or before the last "+
				"gc time %s rev %d, but was not included in the latest "+
				"gc op revision %d", rmd.Revision(), lastGCRevisionTime,
				lastGCRev, gcRevision)
		}
	}
	sc.log.CDebugf(ctx, "Folder %v has %d expected live blocks, "+
		"total %d bytes (%d MD bytes)", tlfID, len(expectedLiveBlocks),
		expectedRef, expectedMDRef)

	currMD := rmds[len(rmds)-1]
	expectedUsage := currMD.DiskUsage()
	if expectedUsage != expectedRef {
		return fmt.Errorf("Expected ref bytes %d doesn't match latest disk "+
			"usage %d", expectedRef, expectedUsage)
	}
	expectedMDUsage := currMD.MDDiskUsage()
	if expectedMDUsage != expectedMDRef {
		return fmt.Errorf("Expected MD ref bytes %d doesn't match latest disk "+
			"MD usage %d", expectedMDRef, expectedMDUsage)
	}

	// Then, using the current MD head, start at the root of the FS
	// and recursively walk the directory tree to find all the blocks
	// that are currently accessible.
	rootNode, _, _, err := ops.getRootNode(ctx)
	if err != nil {
		return err
	}
	rootPath := ops.nodeCache.PathFromNode(rootNode)
	if g, e := rootPath.TailPointer(), currMD.data.Dir.BlockPointer; g != e {
		return fmt.Errorf("Current MD root pointer %v doesn't match root "+
			"node pointer %v", e, g)
	}
	actualLiveBlocks[rootPath.TailPointer()] = currMD.data.Dir.EncodedSize
	if err := sc.findAllBlocksInPath(ctx, lState, ops, currMD.ReadOnly(),
		rootPath, actualLiveBlocks); err != nil {
		return err
	}
	sc.log.CDebugf(ctx, "Folder %v has %d actual live blocks",
		tlfID, len(actualLiveBlocks))

	// Compare the two and see if there are any differences. Don't use
	// reflect.DeepEqual so we can print out exactly what's wrong.
	var extraBlocks []data.BlockPointer
	actualSize := uint64(0)
	actualMDSize := uint64(0)
	for ptr, size := range actualLiveBlocks {
		if ptr.GetBlockType() == keybase1.BlockType_MD {
			actualMDSize += uint64(size)
		} else {
			actualSize += uint64(size)
		}
		if !expectedLiveBlocks[ptr] {
			extraBlocks = append(extraBlocks, ptr)
		}
	}
	if len(extraBlocks) != 0 {
		sc.log.CWarningf(ctx, "%v: Extra live blocks found: %v",
			tlfID, extraBlocks)
		return fmt.Errorf("Folder %v has inconsistent state", tlfID)
	}
	var missingBlocks []data.BlockPointer
	for ptr := range expectedLiveBlocks {
		if _, ok := actualLiveBlocks[ptr]; !ok {
			missingBlocks = append(missingBlocks, ptr)
		}
	}
	if len(missingBlocks) != 0 {
		sc.log.CWarningf(ctx, "%v: Expected live blocks not found: %v",
			tlfID, missingBlocks)
		return fmt.Errorf("Folder %v has inconsistent state", tlfID)
	}

	if actualSize != expectedRef {
		return fmt.Errorf("Actual size %d doesn't match expected size %d",
			actualSize, expectedRef)
	}
	if actualMDSize != expectedMDRef {
		return fmt.Errorf("Actual MD size %d doesn't match expected MD size %d",
			actualMDSize, expectedMDRef)
	}

	// Check that the set of referenced blocks matches exactly what
	// the block server knows about.
	bserverLocal, ok := sc.config.BlockServer().(blockServerLocal)
	if !ok {
		if jbs, jok := sc.config.BlockServer().(journalBlockServer); jok {
			bserverLocal, ok = jbs.BlockServer.(blockServerLocal)
			if !ok {
				sc.log.CDebugf(ctx, "Bad block server: %T", jbs.BlockServer)
			}
		}
	}
	if !ok {
		return errors.New("StateChecker only works against BlockServerLocal")
	}
	bserverKnownBlocks, err := bserverLocal.getAllRefsForTest(ctx, tlfID)
	if err != nil {
		return err
	}

	blockRefsByID := make(map[kbfsblock.ID]blockRefMap)
	for ptr := range expectedLiveBlocks {
		if _, ok := blockRefsByID[ptr.ID]; !ok {
			blockRefsByID[ptr.ID] = make(blockRefMap)
		}
		err := blockRefsByID[ptr.ID].put(ptr.Context, liveBlockRef, "")
		if err != nil {
			return err
		}
	}
	for ptr := range archivedBlocks {
		if _, ok := blockRefsByID[ptr.ID]; !ok {
			blockRefsByID[ptr.ID] = make(blockRefMap)
		}
		err := blockRefsByID[ptr.ID].put(ptr.Context, archivedBlockRef, "")
		if err != nil {
			return err
		}
	}

	if g, e := bserverKnownBlocks, blockRefsByID; !reflect.DeepEqual(g, e) {
		for id, eRefs := range e {
			if gRefs := g[id]; !reflect.DeepEqual(gRefs, eRefs) {
				sc.log.CDebugf(ctx, "Refs for ID %v don't match.  "+
					"Got %v, expected %v", id, gRefs, eRefs)
			}
		}
		for id, gRefs := range g {
			if _, ok := e[id]; !ok {
				sc.log.CDebugf(ctx, "Did not find matching expected "+
					"ID for found block %v (with refs %v)", id, gRefs)
			}
		}

		return fmt.Errorf("Folder %v has inconsistent state", tlfID)
	}

	// TODO: Check the archived and deleted blocks as well.
	return nil
}
