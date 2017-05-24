package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdResetOne(
	ctx context.Context, config libkbfs.Config, tlfPath string,
	checkValid, dryRun, force bool) error {
	irmd, uid, err := mdGetMergedHeadForWriter(ctx, config, tlfPath)
	if err != nil {
		return err
	}

	// This function is loosely adapted from
	// folderBranchOps.initMDLocked.

	if checkValid {
		rootPtr := irmd.Data().Dir.BlockPointer
		if rootPtr.Ref().IsValid() {
			var dirBlock libkbfs.DirBlock
			err = config.BlockOps().Get(
				ctx, irmd, rootPtr, &dirBlock, libkbfs.NoCacheEntry)
			if err == nil {
				fmt.Printf("Got no error when getting root block %s; not doing anything\n", rootPtr)
				return nil
			}
			fmt.Printf("Got error %s when getting root block %s, so revision %d is broken. Making successor...\n",
				err, rootPtr, irmd.Revision())
		} else {
			// This happens in the wild, but only for folders used
			// for journal-related testing early on.
			fmt.Printf("Root block pointer is invalid, so revision %d is broken. Making successor...\n",
				irmd.Revision())
		}
	}

	rmdNext, err := irmd.MakeSuccessor(ctx, config.MetadataVersion(),
		config.Codec(), config.Crypto(), config.KeyManager(),
		config.KBPKI(), irmd.MdID(), true)
	if err != nil {
		return err
	}

	// TODO: Add an option to scan for and use the last known good
	// root block.
	_, info, readyBlockData, err :=
		libkbfs.ResetRootBlock(ctx, config, uid, rmdNext)
	if err != nil {
		return err
	}

	fmt.Printf(
		"Will put an empty root block for tlfID=%s with blockInfo=%s and bufLen=%d\n",
		rmdNext.TlfID(), info, readyBlockData.GetEncodedSize())
	fmt.Print("Will put MD:\n")
	err = mdDumpReadOnlyRMD(ctx, config, rmdNext.ReadOnly())
	if err != nil {
		return err
	}

	if dryRun {
		fmt.Print("Dry-run set; not doing anything\n")
		return nil
	}

	if !force {
		fmt.Print("Are you sure you want to continue? [y/N]: ")
		response, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil {
			return err
		}
		response = strings.ToLower(strings.TrimSpace(response))
		if response != "y" {
			fmt.Printf("Didn't confirm; not doing anything\n")
			return nil
		}
	}

	fmt.Printf("Putting block %s...\n", info)

	err = libkbfs.PutBlockCheckLimitErrs(
		ctx, config.BlockServer(), config.Reporter(),
		rmdNext.TlfID(), info.BlockPointer, readyBlockData,
		irmd.GetTlfHandle().GetCanonicalName())
	if err != nil {
		return err
	}

	// Assume there's no need to unembed the block changes.

	fmt.Printf("Putting revision %d...\n", rmdNext.Revision())

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	newIrmd, err := config.MDOps().Put(ctx, rmdNext, session.VerifyingKey)
	if err != nil {
		return err
	}

	fmt.Printf("New MD has revision %d\n", newIrmd.Revision())

	return nil
}

const mdResetUsageStr = `Usage:
  kbfstool md reset /keybase/[public|private]/user1,assertion2

`

func mdReset(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md reset", flag.ContinueOnError)
	checkValid := flags.Bool("c", true, "If set, don't do anything if the existing root block is valid")
	dryRun := flags.Bool("d", false, "Dry run: don't actually do anything.")
	force := flags.Bool("f", false, "If set, skip confirmation prompt.")
	err := flags.Parse(args)
	if err != nil {
		printError("md reset", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) != 1 {
		fmt.Print(mdResetUsageStr)
		return 1
	}

	err = mdResetOne(ctx, config, inputs[0], *checkValid, *dryRun, *force)
	if err != nil {
		printError("md reset", err)
		return 1
	}

	fmt.Print("\n")

	return 0
}
