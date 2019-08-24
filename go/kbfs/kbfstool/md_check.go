package main

import (
	"flag"
	"fmt"
	"path/filepath"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/libkey"
	"golang.org/x/net/context"
)

const mdCheckUsageStr = `Usage:
  kbfstool md check input [inputs...]

Each input must be in the same format as in md dump. However,
revisions in a revision range rev1-rev2 are always checked in
descending order, regardless of whether rev1 <= rev2 or rev1 > rev2.

`

// TODO: The below checks could be sped up by fetching blocks in
// parallel.

// TODO: Factor out common code with StateChecker.findAllBlocksInPath.

func checkDirBlock(ctx context.Context, config libkbfs.Config,
	name string, kmd libkey.KeyMetadata, info data.BlockInfo,
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

	var dirBlock data.DirBlock
	err = config.BlockOps().Get(ctx, kmd, info.BlockPointer, &dirBlock, data.NoCacheEntry)
	if err != nil {
		return err
	}

	for entryName, entry := range dirBlock.Children {
		switch entry.Type {
		case data.File, data.Exec:
			_ = checkFileBlock(
				ctx, config, filepath.Join(name, entryName),
				kmd, entry.BlockInfo, verbose)
		case data.Dir:
			_ = checkDirBlock(
				ctx, config, filepath.Join(name, entryName),
				kmd, entry.BlockInfo, verbose)
		case data.Sym:
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
	name string, kmd libkey.KeyMetadata, info data.BlockInfo,
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

	var fileBlock data.FileBlock
	err = config.BlockOps().Get(ctx, kmd, info.BlockPointer, &fileBlock, data.NoCacheEntry)
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

// mdCheckChain checks that every MD object in the given list is a
// valid successor of the next object in the list. Along the way, it
// also checks that the root blocks that haven't been
// garbage-collected are present. It returns a list of MD objects with
// valid roots, in reverse revision order. If multiple MD objects have
// the same root (which are assumed to all be adjacent), the most
// recent one is returned.
func mdCheckChain(ctx context.Context, config libkbfs.Config,
	reversedIRMDs []libkbfs.ImmutableRootMetadata, verbose bool) (
	reversedIRMDsWithRoots []libkbfs.ImmutableRootMetadata) {
	fmt.Printf("Checking chain from rev %d to %d...\n",
		reversedIRMDs[0].Revision(), reversedIRMDs[len(reversedIRMDs)-1].Revision())
	gcUnrefs := make(map[data.BlockRef]bool)
	for i, irmd := range reversedIRMDs {
		currRev := irmd.Revision()
		mdData := irmd.Data()
		rootPtr := mdData.Dir.BlockPointer
		switch {
		case !rootPtr.Ref().IsValid():
			// This happens in the wild, but only for
			// folders used for journal-related testing
			// early on.
			fmt.Printf("Skipping checking root for rev %d (is invalid)\n",
				currRev)
		case gcUnrefs[rootPtr.Ref()]:
			if verbose {
				fmt.Printf("Skipping checking root for rev %d (GCed)\n",
					currRev)
			}
		default:
			fmt.Printf("Checking root for rev %d (%s)...\n",
				currRev, rootPtr.Ref())
			var dirBlock data.DirBlock
			err := config.BlockOps().Get(
				ctx, irmd, rootPtr, &dirBlock, data.NoCacheEntry)
			if err != nil {
				fmt.Printf("Got error while checking root "+
					"for rev %d: %v\n",
					currRev, err)
			} else if len(reversedIRMDsWithRoots) == 0 ||
				reversedIRMDsWithRoots[len(reversedIRMDsWithRoots)-1].Data().Dir.BlockPointer != rootPtr {
				reversedIRMDsWithRoots = append(reversedIRMDsWithRoots, irmd)
			}
		}

		for _, op := range mdData.Changes.Ops {
			if gcOp, ok := op.(*libkbfs.GCOp); ok {
				for _, unref := range gcOp.Unrefs() {
					gcUnrefs[unref.Ref()] = true
				}
			}
		}

		if i == len(reversedIRMDs)-1 {
			break
		}

		irmdPrev := reversedIRMDs[i+1]
		predRev := irmdPrev.Revision()

		if verbose {
			fmt.Printf("Checking %d -> %d link...\n",
				predRev, currRev)
		}
		err := irmdPrev.CheckValidSuccessor(
			irmdPrev.MdID(), irmd.ReadOnly())
		if err != nil {
			fmt.Printf("Got error while checking %d -> %d link: %v\n",
				predRev, currRev, err)
		}

		irmd = irmdPrev
	}
	return reversedIRMDsWithRoots
}

func mdCheckIRMDs(ctx context.Context, config libkbfs.Config,
	tlfStr, branchStr string, reversedIRMDs []libkbfs.ImmutableRootMetadata,
	verbose bool) error {
	reversedIRMDsWithRoots :=
		mdCheckChain(ctx, config, reversedIRMDs, verbose)

	fmt.Printf("Retrieved %d MD objects with roots\n", len(reversedIRMDsWithRoots))

	for _, irmd := range reversedIRMDsWithRoots {
		// No need to check the blocks for unembedded changes,
		// since they're already checked upon retrieval.
		name := mdJoinInput(tlfStr, branchStr, irmd.Revision().String(), "")
		_ = checkDirBlock(ctx, config, name, irmd,
			irmd.Data().Dir.BlockInfo, verbose)
	}
	return nil
}

func mdCheck(ctx context.Context, config libkbfs.Config, args []string) (
	exitStatus int) {
	flags := flag.NewFlagSet("kbfs md check", flag.ContinueOnError)
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
		tlfStr, branchStr, startStr, stopStr, err := mdSplitInput(input)
		if err != nil {
			printError("md check", err)
			return 1
		}

		tlfID, branchID, start, stop, err :=
			mdParseInput(ctx, config, tlfStr, branchStr, startStr, stopStr)
		if err != nil {
			printError("md check", err)
			return 1
		}

		min := start
		max := stop
		if start > stop {
			min = stop
			max = start
		}

		// The returned RMDs are already verified, so we don't
		// have to do anything else.
		//
		// TODO: Chunk the range between start and stop.
		irmds, err := mdGet(ctx, config, tlfID, branchID, min, max)
		if err != nil {
			printError("md check", err)
			return 1
		}

		if len(irmds) == 0 {
			fmt.Printf("No result found for %q\n\n", input)
			continue
		}

		reversedIRMDs := reverseIRMDList(irmds)
		err = mdCheckIRMDs(ctx, config, tlfStr, branchStr, reversedIRMDs, *verbose)
		if err != nil {
			printError("md check", err)
			return 1
		}

		fmt.Print("\n")
	}

	return 0
}
