package main

import (
	"flag"
	"fmt"
	"path/filepath"

	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const mdCheckUsageStr = `Usage:
  kbfstool md check input [inputs...]

Each input must be in the same format as in md dump.

`

// TODO: The below checks could be sped up by fetching blocks in
// parallel.

// TODO: Factor out common code with StateChecker.findAllBlocksInPath.

func checkDirBlock(ctx context.Context, config libkbfs.Config,
	name string, kmd libkbfs.KeyMetadata, info libkbfs.BlockInfo,
	verbose bool) (err error) {
	if verbose {
		fmt.Printf("Checking %s (dir block %v)...\n", name, info)
	} else {
		fmt.Printf("Checking %s...\n", name)
	}
	defer func() {
		if err != nil {
			fmt.Printf("Got error while checking %s: %v\n",
				name, err)
		}
	}()

	var dirBlock libkbfs.DirBlock
	err = config.BlockOps().Get(ctx, kmd, info.BlockPointer, &dirBlock, libkbfs.NoCacheEntry)
	if err != nil {
		return err
	}

	for entryName, entry := range dirBlock.Children {
		switch entry.Type {
		case libkbfs.File, libkbfs.Exec:
			_ = checkFileBlock(
				ctx, config, filepath.Join(name, entryName),
				kmd, entry.BlockInfo, verbose)
		case libkbfs.Dir:
			_ = checkDirBlock(
				ctx, config, filepath.Join(name, entryName),
				kmd, entry.BlockInfo, verbose)
		case libkbfs.Sym:
			if verbose {
				fmt.Printf("Skipping symlink %s -> %s\n",
					entryName, entry.SymPath)
			}
			continue
		default:
			fmt.Printf("Entry %s has unknown type %s",
				entryName, entry.Type)
		}
	}

	return nil
}

func checkFileBlock(ctx context.Context, config libkbfs.Config,
	name string, kmd libkbfs.KeyMetadata, info libkbfs.BlockInfo,
	verbose bool) (err error) {
	if verbose {
		fmt.Printf("Checking %s (file block %v)...\n", name, info)
	} else {
		fmt.Printf("Checking %s...\n", name)
	}
	defer func() {
		if err != nil {
			fmt.Printf("Got error while checking %s: %v\n",
				name, err)
		}
	}()

	var fileBlock libkbfs.FileBlock
	err = config.BlockOps().Get(ctx, kmd, info.BlockPointer, &fileBlock, libkbfs.NoCacheEntry)
	if err != nil {
		return err
	}

	if fileBlock.IsInd {
		// TODO: Check continuity of off+len if Holes is false
		// for all blocks.
		for _, iptr := range fileBlock.IPtrs {
			_ = checkFileBlock(
				ctx, config,
				fmt.Sprintf("%s (off=%d)", name, iptr.Off),
				kmd, iptr.BlockInfo, verbose)
		}
	}
	return nil
}

// mdCheckChain checks that the given MD object is a valid successor
// of the previous revision, and so on all the way back to the given
// revision. Along the way, it also checks that the root blocks that
// haven't been garbage-collected are present. It returns a list of MD
// objects with valid roots, in reverse revision order. If multiple MD
// objects have the same root (which are assumed to all be adjacent),
// the most recent one is returned.
func mdCheckChain(ctx context.Context, config libkbfs.Config,
	irmd libkbfs.ImmutableRootMetadata,
	minRevision kbfsmd.Revision, verbose bool) (
	irmdsWithRoots []libkbfs.ImmutableRootMetadata, err error) {
	fmt.Printf("Checking chain from rev %d to %d...\n",
		minRevision, irmd.Revision())
	gcUnrefs := make(map[libkbfs.BlockRef]bool)
	for {
		rootPtr := irmd.Data().Dir.BlockPointer
		if !rootPtr.Ref().IsValid() {
			// This happens in the wild, but only for
			// folders used for journal-related testing
			// early on.
			fmt.Printf("Skipping checking root for rev %d (is invalid)\n",
				irmd.Revision())
		} else if gcUnrefs[rootPtr.Ref()] {
			if verbose {
				fmt.Printf("Skipping checking root for rev %d (GCed)\n",
					irmd.Revision())
			}
		} else {
			fmt.Printf("Checking root for rev %d (%s)...\n",
				irmd.Revision(), rootPtr.Ref())
			var dirBlock libkbfs.DirBlock
			err := config.BlockOps().Get(
				ctx, irmd, rootPtr, &dirBlock, libkbfs.NoCacheEntry)
			if err != nil {
				fmt.Printf("Got error while checking root "+
					"for rev %d: %v\n",
					irmd.Revision(), err)
			} else if len(irmdsWithRoots) == 0 ||
				irmdsWithRoots[len(irmdsWithRoots)-1].Data().Dir.BlockPointer != rootPtr {
				irmdsWithRoots = append(irmdsWithRoots, irmd)
			}
		}

		for _, op := range irmd.Data().Changes.Ops {
			if gcOp, ok := op.(*libkbfs.GCOp); ok {
				for _, unref := range gcOp.Unrefs() {
					gcUnrefs[unref.Ref()] = true
				}
			}
		}

		if irmd.Revision() <= minRevision {
			break
		}

		if verbose {
			fmt.Printf("Fetching rev %d...\n", irmd.Revision()-1)
		}

		// TODO: Getting in chunks would be faster.
		irmdPrev, err := mdGet(ctx, config, irmd.TlfID(),
			irmd.BID(), irmd.Revision()-1)
		if err != nil {
			fmt.Printf("Got error while fetching rev %d: %v\n", irmd.Revision()-1, err)
			break
		}

		if irmdPrev == (libkbfs.ImmutableRootMetadata{}) {
			fmt.Printf("Rev %d missing\n", irmd.Revision()-1)
			break
		}

		if verbose {
			fmt.Printf("Checking %d -> %d link...\n",
				irmd.Revision()-1, irmd.Revision())
		}
		err = irmdPrev.CheckValidSuccessor(
			irmdPrev.MdID(), irmd.ReadOnly())
		if err != nil {
			fmt.Printf("Got error while checking %d -> %d link: %v\n",
				irmd.Revision()-1, irmd.Revision(), err)
		}

		irmd = irmdPrev
	}
	return irmdsWithRoots, nil
}

func mdCheckOne(ctx context.Context, config libkbfs.Config,
	input string, irmd libkbfs.ImmutableRootMetadata,
	mdLimit int, verbose bool) error {
	// Subtract one for irmd.
	mdLimit--
	if mdLimit < 0 {
		mdLimit = 0
	}
	var minRevision kbfsmd.Revision
	if irmd.Revision() >= kbfsmd.RevisionInitial+
		kbfsmd.Revision(mdLimit) {
		minRevision = irmd.Revision() -
			kbfsmd.Revision(mdLimit)
	} else {
		minRevision = kbfsmd.RevisionInitial
	}
	irmdsWithRoots, _ := mdCheckChain(
		ctx, config, irmd, minRevision, verbose)

	fmt.Printf("Retrieved %d MD objects with roots\n", len(irmdsWithRoots))

	for _, irmd := range irmdsWithRoots {
		fmt.Printf("Checking revision %d...\n", irmd.Revision())
		data := irmd.Data()

		// No need to check the blocks for unembedded changes,
		// since they're already checked upon retrieval.

		_ = checkDirBlock(
			ctx, config, input, irmd, data.Dir.BlockInfo, verbose)
	}
	return nil
}

func mdCheck(ctx context.Context, config libkbfs.Config, args []string) (
	exitStatus int) {
	flags := flag.NewFlagSet("kbfs md check", flag.ContinueOnError)
	mdLimit := flags.Int("fetch-limit", 100,
		"Maximum number of MD objects to fetch (per argument).")
	verbose := flags.Bool("v", false, "Print verbose output.")
	err := flags.Parse(args)
	if err != nil {
		printError("md check", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) < 1 {
		fmt.Print(mdCheckUsageStr)
		return 1
	}

	for _, input := range inputs {
		// The returned RMD is already verified, so we don't
		// have to do anything else.
		irmd, err := mdParseAndGet(ctx, config, input)
		if err != nil {
			printError("md check", err)
			return 1
		}

		if irmd == (libkbfs.ImmutableRootMetadata{}) {
			fmt.Printf("No result found for %q\n\n", input)
			continue
		}

		err = mdCheckOne(ctx, config, input, irmd, *mdLimit, *verbose)
		if err != nil {
			printError("md check", err)
			return 1
		}

		fmt.Print("\n")
	}

	return 0
}
