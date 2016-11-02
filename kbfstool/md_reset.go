package main

import (
	"flag"
	"fmt"

	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdResetOne(ctx context.Context, config libkbfs.Config, path string) error {
	p, err := fsrpc.NewPath(path)
	if err != nil {
		return err
	}
	if p.PathType != fsrpc.TLFPathType {
		return fmt.Errorf("%q is not a TLF path", path)
	}
	if len(p.TLFComponents) > 0 {
		return fmt.Errorf("%q is not the root path of a TLF", path)
	}
	handle, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), p.TLFName, p.Public)
	if err != nil {
		return err
	}

	username, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}

	// Make sure we're a writer before doing anything else.
	if !handle.IsWriter(uid) {
		return libkbfs.NewWriteAccessError(
			handle, username, handle.GetCanonicalPath())
	}

	fmt.Printf("Looking for unmerged branch...\n")

	_, unmergedIRMD, err := config.MDOps().GetForHandle(
		ctx, handle, libkbfs.Unmerged)
	if err != nil {
		return err
	}
	if unmergedIRMD != (libkbfs.ImmutableRootMetadata{}) {
		return fmt.Errorf(
			"%s has unmerged data; try unstaging it first", path)
	}

	fmt.Printf("Getting latest metadata...\n")

	_, irmd, err := config.MDOps().GetForHandle(
		ctx, handle, libkbfs.Merged)
	if err != nil {
		return err
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		fmt.Printf("No TLF found for %q\n\n", path)
		return nil
	}

	rootPtr := irmd.Data().Dir.BlockInfo.BlockPointer
	var dirBlock libkbfs.DirBlock
	err = config.BlockOps().Get(ctx, irmd, rootPtr, &dirBlock)
	if err == nil {
		fmt.Printf("Got no error when getting root block %s; aborting\n", rootPtr)
		return nil
	}

	fmt.Printf("Got error %s when getting root block %s, so revision %d is broken. Making successor...\n",
		err, rootPtr, irmd.Revision())

	rmdNext, err := irmd.MakeSuccessor(config.Codec(), irmd.MdID(), true)
	if err != nil {
		return err
	}

	_, info, readyBlockData, err :=
		libkbfs.ResetRootBlock(ctx, config, uid, rmdNext)
	if err != nil {
		return err
	}

	dryRun := true

	fmt.Printf("Putting block %s...\n", info)

	if dryRun {
		fmt.Printf("Dry run: would call BlockServer.Put(tlfID=%s, blockInfo=%s, bufLen=%d)\n",
			rmdNext.TlfID(), info, readyBlockData.GetEncodedSize())
	} else {
		err := libkbfs.PutBlockCheckQuota(
			ctx, config.BlockServer(), config.Reporter(),
			rmdNext.TlfID(), info.BlockPointer, readyBlockData,
			handle.GetCanonicalName())
		if err != nil {
			return err
		}
	}

	// TODO: Implement maybeUnembedAndPutBlocks.

	fmt.Printf("Putting revision %d...\n", rmdNext.Revision())

	if dryRun {
		fmt.Printf("Dry run: would put:\n")
		err := mdDumpOneReadOnly(ctx, config, rmdNext.ReadOnly())
		if err != nil {
			return err
		}
	} else {
		mdID, err := config.MDOps().Put(ctx, rmdNext)
		if err != nil {
			return err
		}

		fmt.Printf("New MD has id %s\n", mdID)
	}

	return nil
}

const mdResetUsageStr = `Usage:
  kbfstool md reset TLF

where TLF can be:

  - a TLF ID string (32 hex digits),
  - or a keybase TLF path (e.g., "/keybase/public/user1,user2", or
    "/keybase/private/user1,assertion2").

`

func mdReset(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md reset", flag.ContinueOnError)
	flags.Parse(args)

	inputs := flags.Args()
	if len(inputs) != 1 {
		fmt.Print(mdResetUsageStr)
		return 1
	}

	err := mdResetOne(ctx, config, inputs[0])
	if err != nil {
		printError("md reset", err)
		return 1
	}

	fmt.Print("\n")

	return 0
}
