package main

import (
	"flag"
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"golang.org/x/net/context"
)

func mdDumpImmutableRMD(ctx context.Context, config libkbfs.Config,
	replacements replacementMap,
	irmd libkbfs.ImmutableRootMetadata) error {
	err := mdDumpFillReplacements(
		ctx, config.Codec(), config.KeybaseService(), config, "md dump",
		irmd.GetBareRootMetadata(), irmd.Extra(), replacements)
	if err != nil {
		printError("md dump", err)
	}

	fmt.Print("Immutable metadata\n")
	fmt.Print("------------------\n")

	fmt.Printf("MD ID: %s\n", irmd.MdID())
	fmt.Printf("Local timestamp: %s\n", irmd.LocalTimestamp())
	fmt.Printf("Last modifying device (verifying key): %s\n",
		mdDumpReplaceAll(irmd.LastModifyingWriterVerifyingKey().String(), replacements))
	fmt.Print("\n")

	return mdDumpReadOnlyRMDWithReplacements(
		ctx, config.Codec(), replacements, irmd.ReadOnly())
}

func mdDumpChunk(ctx context.Context, config libkbfs.Config,
	replacements replacementMap, tlfStr, branchStr string,
	tlfID tlf.ID, branchID kbfsmd.BranchID,
	start, stop kbfsmd.Revision) error {
	min := start
	max := stop
	reversed := false
	if start > stop {
		min = stop
		max = start
		reversed = true
	}

	irmds, err := mdGet(ctx, config, tlfID, branchID, min, max)
	if err != nil {
		return err
	}

	if reversed {
		irmds = reverseIRMDList(irmds)
	}

	fmt.Printf("%d results for %q:\n\n", len(irmds),
		mdJoinInput(tlfStr, branchStr, start.String(), stop.String()))

	for _, irmd := range irmds {
		err = mdDumpImmutableRMD(ctx, config, replacements, irmd)
		if err != nil {
			return err
		}
		fmt.Print("\n")
	}

	return nil
}

func mdDumpInput(ctx context.Context, config libkbfs.Config,
	replacements replacementMap, input string) error {
	tlfStr, branchStr, startStr, stopStr, err := mdSplitInput(input)
	if err != nil {
		return err
	}

	tlfID, branchID, start, stop, err :=
		mdParseInput(ctx, config, tlfStr, branchStr, startStr, stopStr)
	if err != nil {
		return err
	}

	// TODO: Ideally we'd fetch MDs concurrently with dumping
	// them, but this works well enough for now.
	//
	// TODO: Make maxChunkSize configurable.

	const maxChunkSize = 100

	if start <= stop {
		for chunkStart := start; chunkStart <= stop; chunkStart += maxChunkSize {
			chunkStop := chunkStart + maxChunkSize - 1
			if chunkStop > stop {
				chunkStop = stop
			}
			err = mdDumpChunk(ctx, config, replacements, tlfStr, branchStr, tlfID, branchID, chunkStart, chunkStop)
			if err != nil {
				return err
			}
		}
	} else {
		for chunkStart := start; chunkStart >= stop; chunkStart -= maxChunkSize {
			chunkStop := chunkStart - maxChunkSize + 1
			if chunkStop < stop {
				chunkStop = stop
			}

			err = mdDumpChunk(ctx, config, replacements, tlfStr, branchStr, tlfID, branchID, chunkStart, chunkStop)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

const mdDumpUsageStr = `Usage:
  kbfstool md dump input [inputs...]

Each input must be in the following format:

  TLF
  TLF:Branch
  TLF^RevisionRange
  TLF:Branch^RevisionRange

where TLF can be:

  - a TLF ID string (32 hex digits), or
  - a keybase TLF path (e.g., "/keybase/public/user1,user2", or
    "/keybase/private/user1,assertion2");

Branch can be:

  - a Branch ID string (32 hex digits),
  - the string "device", which indicates the unmerged branch for the
    current device, or the master branch if there is no unmerged branch,
  - the string "master", which is a shorthand for
    the ID of the master branch "00000000000000000000000000000000", or
  - omitted, in which case it is treated as if it were the string "device";

and RevisionRange can be in the following format:

  Revision
  Revision-Revision

where Revision can be:

  - a hex number prefixed with "0x",
  - a decimal number with no prefix,
  - the string "latest", which indicates the latest revision for the
    branch, or
  - omitted, in which case it is treated as if it were the string "latest".

If a single revision "rev" is specified, it's treated as if the range
"rev-rev" was specified. If a range "rev1-rev2" is specified, then the
revisions are dumped in ascending order if rev1 <= rev2, and descending
order if rev1 > rev2.
`

func mdDump(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md dump", flag.ContinueOnError)
	err := flags.Parse(args)
	if err != nil {
		printError("md dump", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) < 1 {
		fmt.Print(mdDumpUsageStr)
		return 1
	}

	replacements := make(replacementMap)

	for _, input := range inputs {
		err := mdDumpInput(ctx, config, replacements, input)
		if err != nil {
			printError("md dump", err)
			return 1
		}
	}

	return 0
}
