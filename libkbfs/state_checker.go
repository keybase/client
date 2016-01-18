package libkbfs

import (
	"errors"
	"fmt"
	"reflect"

	"github.com/keybase/client/go/logger"
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
// the blocksFound map, if the given path represents an indirect
// block.
func (sc *StateChecker) findAllFileBlocks(ctx context.Context,
	lState *lockState, ops *folderBranchOps, md *RootMetadata, file path,
	blockSizes map[BlockPointer]uint32) error {
	fblock, err := ops.getFileBlockForReading(ctx, lState, md,
		file.tailPointer(), file.Branch, file)
	if err != nil {
		return err
	}

	if !fblock.IsInd {
		return nil
	}

	parentPath := file.parentPath()
	for _, childPtr := range fblock.IPtrs {
		blockSizes[childPtr.BlockPointer] = childPtr.EncodedSize
		p := parentPath.ChildPath(file.tailName(), childPtr.BlockPointer)
		err := sc.findAllFileBlocks(ctx, lState, ops, md, p, blockSizes)
		if err != nil {
			return err
		}
	}
	return nil
}

// findAllBlocksInPath adds all blocks found within this directory to
// the blockSizes map, and then recursively checks all
// subdirectories.
func (sc *StateChecker) findAllBlocksInPath(ctx context.Context,
	lState *lockState, ops *folderBranchOps, md *RootMetadata, dir path,
	blockSizes map[BlockPointer]uint32) error {
	dblock, err := ops.getDirBlockForReading(ctx, lState, md,
		dir.tailPointer(), dir.Branch, dir)
	if err != nil {
		return err
	}

	for name, de := range dblock.Children {
		if de.Type == Sym {
			continue
		}

		blockSizes[de.BlockPointer] = de.EncodedSize
		p := dir.ChildPath(name, de.BlockPointer)

		if de.Type == Dir {
			err := sc.findAllBlocksInPath(ctx, lState, ops, md, p, blockSizes)
			if err != nil {
				return err
			}
		} else {
			// If it's a file, check to see if it's indirect.
			err := sc.findAllFileBlocks(ctx, lState, ops, md, p, blockSizes)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// CheckMergedState verifies that the state for the given tlf is
// consistent.
func (sc *StateChecker) CheckMergedState(ctx context.Context, tlf TlfID) error {
	// Blow away MD cache so we don't have any lingering re-embedded
	// block changes (otherwise we won't be able to learn their sizes).
	sc.config.SetMDCache(NewMDCacheStandard(5000))

	// Fetch all the MD updates for this folder, and use the block
	// change lists to build up the set of currently referenced blocks.
	rmds, err := getMergedMDUpdates(ctx, sc.config, tlf,
		MetadataRevisionInitial)
	if err != nil {
		return err
	}
	if len(rmds) == 0 {
		sc.log.CDebugf(ctx, "No state to check for folder %s", tlf)
		return nil
	}

	lState := makeFBOLockState()

	// Re-embed block changes.
	kbfsOps, ok := sc.config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	fb := FolderBranch{tlf, MasterBranch}
	ops := kbfsOps.getOps(fb)
	if err := ops.reembedBlockChanges(ctx, lState, rmds); err != nil {
		return err
	}

	// Build the expected block list.
	expectedLiveBlocks := make(map[BlockPointer]bool)
	expectedRef := uint64(0)
	allKnownBlocks := make(map[BlockPointer]bool)
	actualLiveBlocks := make(map[BlockPointer]uint32)
	for _, rmd := range rmds {
		// Don't process copies.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		// Any unembedded block changes also count towards the actual size
		if info := rmd.data.cachedChanges.Info; info.BlockPointer != zeroPtr {
			sc.log.CDebugf(ctx, "Unembedded block change: %v, %d",
				info.BlockPointer, info.EncodedSize)
			allKnownBlocks[info.BlockPointer] = true
			actualLiveBlocks[info.BlockPointer] = info.EncodedSize
		}

		for _, op := range rmd.data.Changes.Ops {
			for _, ptr := range op.Refs() {
				if ptr != zeroPtr {
					expectedLiveBlocks[ptr] = true
					allKnownBlocks[ptr] = true
				}
			}
			for _, ptr := range op.Unrefs() {
				delete(expectedLiveBlocks, ptr)
				if ptr != zeroPtr {
					allKnownBlocks[ptr] = true
				}
			}
			for _, update := range op.AllUpdates() {
				delete(expectedLiveBlocks, update.Unref)
				if update.Unref != zeroPtr {
					allKnownBlocks[update.Unref] = true
				}
				if update.Ref != zeroPtr {
					expectedLiveBlocks[update.Ref] = true
					allKnownBlocks[update.Ref] = true
				}
			}
		}
		expectedRef += rmd.RefBytes
		expectedRef -= rmd.UnrefBytes
	}
	sc.log.CDebugf(ctx, "Folder %v has %d expected live blocks, total %d bytes",
		tlf, len(expectedLiveBlocks), expectedRef)

	currMD := rmds[len(rmds)-1]
	expectedUsage := currMD.DiskUsage
	if expectedUsage != expectedRef {
		return fmt.Errorf("Expected ref bytes %d doesn't match latest disk "+
			"usage %d", expectedRef, expectedUsage)
	}

	// Then, using the current MD head, start at the root of the FS
	// and recursively walk the directory tree to find all the blocks
	// that are currently accessible.
	rootNode, _, _, err := ops.getRootNode(ctx)
	if err != nil {
		return err
	}
	rootPath := ops.nodeCache.PathFromNode(rootNode)
	if g, e := rootPath.tailPointer(), currMD.data.Dir.BlockPointer; g != e {
		return fmt.Errorf("Current MD root pointer %v doesn't match root "+
			"node pointer %v", e, g)
	}
	actualLiveBlocks[rootPath.tailPointer()] = currMD.data.Dir.EncodedSize
	if err := sc.findAllBlocksInPath(ctx, lState, ops, currMD, rootPath,
		actualLiveBlocks); err != nil {
		return err
	}
	sc.log.CDebugf(ctx, "Folder %v has %d actual live blocks",
		tlf, len(actualLiveBlocks))

	// Compare the two and see if there are any differences. Don't use
	// reflect.DeepEqual so we can print out exactly what's wrong.
	var extraBlocks []BlockPointer
	actualSize := uint64(0)
	for ptr, size := range actualLiveBlocks {
		actualSize += uint64(size)
		if !expectedLiveBlocks[ptr] {
			extraBlocks = append(extraBlocks, ptr)
		}
	}
	if len(extraBlocks) != 0 {
		sc.log.CWarningf(ctx, "%v: Extra live blocks found: %v",
			tlf, extraBlocks)
		return fmt.Errorf("Folder %v has inconsistent state", tlf)
	}
	var missingBlocks []BlockPointer
	for ptr := range expectedLiveBlocks {
		if _, ok := actualLiveBlocks[ptr]; !ok {
			missingBlocks = append(missingBlocks, ptr)
		}
	}
	if len(missingBlocks) != 0 {
		sc.log.CWarningf(ctx, "%v: Expected live blocks not found: %v",
			tlf, missingBlocks)
		return fmt.Errorf("Folder %v has inconsistent state", tlf)
	}

	if actualSize != expectedRef {
		return fmt.Errorf("Actual size %d doesn't match expected size %d",
			actualSize, expectedRef)
	}

	// Check that the set of referenced blocks matches exactly what
	// the block server knows about.
	bserverLocal, ok := sc.config.BlockServer().(*BlockServerLocal)
	if !ok {
		return errors.New("StateChecker only works against BlockServerLocal")
	}
	bserverKnownBlocks, err := bserverLocal.getAll(tlf)
	if err != nil {
		return err
	}

	blockRefsByID := make(map[BlockID]map[BlockRefNonce]bool)
	for ptr := range allKnownBlocks {
		if _, ok := blockRefsByID[ptr.ID]; !ok {
			blockRefsByID[ptr.ID] = make(map[BlockRefNonce]bool)
		}
		blockRefsByID[ptr.ID][ptr.RefNonce] = true
	}

	if g, e := bserverKnownBlocks, blockRefsByID; !reflect.DeepEqual(g, e) {
		for id, eRefs := range e {
			if gRefs := g[id]; !reflect.DeepEqual(gRefs, eRefs) {
				sc.log.CDebugf(ctx, "Refs for ID %v don't match.  "+
					"Got %v, expected %v", id, gRefs, eRefs)
			}
		}
		for id := range g {
			if _, ok := e[id]; !ok {
				sc.log.CDebugf(ctx, "Did not find matching expected "+
					"ID for found block %v", id)
			}
		}

		return fmt.Errorf("Folder %v has inconsistent state", tlf)
	}

	// TODO: Check the archived and deleted blocks as well.
	return nil
}
