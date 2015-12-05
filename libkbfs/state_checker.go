package libkbfs

import (
	"errors"
	"fmt"

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
	ops *folderBranchOps, md *RootMetadata, file path,
	blocksFound map[BlockPointer]bool) error {
	fblock, err := ops.getFileBlockForReading(ctx, md, file.tailPointer(), file.Branch, file)
	if err != nil {
		return err
	}

	if !fblock.IsInd {
		return nil
	}

	parentPath := file.parentPath()
	for _, childPtr := range fblock.IPtrs {
		blocksFound[childPtr.BlockPointer] = true
		p := parentPath.ChildPath(file.tailName(), childPtr.BlockPointer)
		err := sc.findAllFileBlocks(ctx, ops, md, p, blocksFound)
		if err != nil {
			return err
		}
	}
	return nil
}

// findAllBlocksInPath adds all blocks found within this directory to
// the blocksFound map, and then recursively checks all
// subdirectories.
func (sc *StateChecker) findAllBlocksInPath(ctx context.Context,
	ops *folderBranchOps, md *RootMetadata, dir path,
	blocksFound map[BlockPointer]bool) error {
	dblock, err := ops.getDirBlockForReading(ctx, md, dir.tailPointer(), dir.Branch, dir)
	if err != nil {
		return err
	}

	for name, de := range dblock.Children {
		if de.Type == Sym {
			continue
		}

		blocksFound[de.BlockPointer] = true
		p := dir.ChildPath(name, de.BlockPointer)

		if de.Type == Dir {
			err := sc.findAllBlocksInPath(ctx, ops, md, p, blocksFound)
			if err != nil {
				return err
			}
		} else {
			// If it's a file, check to see if it's indirect.
			err := sc.findAllFileBlocks(ctx, ops, md, p, blocksFound)
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

	// Re-embed block changes.
	kbfsOps, ok := sc.config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}
	fb := FolderBranch{tlf, MasterBranch}
	ops := kbfsOps.getOps(fb)
	if err := ops.reembedBlockChanges(ctx, rmds); err != nil {
		return err
	}

	// Build the expected block list.
	expectedLiveBlocks := make(map[BlockPointer]bool)
	for _, rmd := range rmds {
		for _, op := range rmd.data.Changes.Ops {
			for _, ptr := range op.Refs() {
				if ptr != zeroPtr {
					expectedLiveBlocks[ptr] = true
				}
			}
			for _, ptr := range op.Unrefs() {
				delete(expectedLiveBlocks, ptr)
			}
			for _, update := range op.AllUpdates() {
				delete(expectedLiveBlocks, update.Unref)
				if update.Ref != zeroPtr {
					expectedLiveBlocks[update.Ref] = true
				}
			}
		}
	}
	sc.log.CDebugf(ctx, "Folder %v has %d expected live blocks",
		tlf, len(expectedLiveBlocks))

	// Then, using the current MD head, start at the root of the FS
	// and recursively walk the directory tree to find all the blocks
	// that are currently accessible.
	currMD := rmds[len(rmds)-1]
	rootNode, _, _, err := ops.GetRootNode(ctx, fb)
	if err != nil {
		return err
	}
	rootPath := ops.nodeCache.PathFromNode(rootNode)
	if g, e := rootPath.tailPointer(), currMD.data.Dir.BlockPointer; g != e {
		return fmt.Errorf("Current MD root pointer %v doesn't match root "+
			"node pointer %v", e, g)
	}
	actualLiveBlocks := make(map[BlockPointer]bool)
	actualLiveBlocks[rootPath.tailPointer()] = true
	if err := sc.findAllBlocksInPath(ctx, ops, currMD, rootPath,
		actualLiveBlocks); err != nil {
		return err
	}
	sc.log.CDebugf(ctx, "Folder %v has %d actual live blocks",
		tlf, len(actualLiveBlocks))

	// Compare the two and see if there are any differences. Don't use
	// reflect.DeepEqual so we can print out exactly what's wrong.
	var extraBlocks []BlockPointer
	for ptr := range actualLiveBlocks {
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
		if !actualLiveBlocks[ptr] {
			missingBlocks = append(missingBlocks, ptr)
		}
	}
	if len(missingBlocks) != 0 {
		sc.log.CWarningf(ctx, "%v: Expected live blocks not found: %v",
			tlf, missingBlocks)
		return fmt.Errorf("Folder %v has inconsistent state", tlf)
	}

	// TODO: Check the archived and deleted blocks as well.
	return nil
}
