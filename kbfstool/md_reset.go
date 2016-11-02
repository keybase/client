package main

import (
	"flag"
	"fmt"

	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdResetOne(ctx context.Context, config libkbfs.Config, path string) error {
	var handle *libkbfs.TlfHandle
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
	name := p.TLFName
outer:
	for {
		var err error
		handle, err = libkbfs.ParseTlfHandle(
			ctx, config.KBPKI(), name, p.Public)
		switch err := err.(type) {
		case nil:
			// No error.
			break outer

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name, so try again.
			name = err.NameToTry

		default:
			// Some other error.
			return err
		}
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

	newDblock := libkbfs.NewDirBlock()
	info, plainSize, readyBlockData, err :=
		libkbfs.ReadyBlock(ctx, config, rmdNext, newDblock, uid)

	now := config.Clock().Now().UnixNano()
	pmd := rmdNext.Data()
	pmd.Dir = libkbfs.DirEntry{
		BlockInfo: info,
		EntryInfo: libkbfs.EntryInfo{
			Type:  libkbfs.Dir,
			Size:  uint64(plainSize),
			Mtime: now,
			Ctime: now,
		},
	}

	co := libkbfs.NewCreateOpForRootDir()
	rmdNext.AddOp(co)
	rmdNext.AddRefBlock(pmd.Dir.BlockInfo)
	rmdNext.SetUnrefBytes(0)

	dryRun := true

	fmt.Printf("Putting block %s...\n", info)

	if dryRun {
		fmt.Printf("Dry run: would call BlockServer.Put(tlfID=%s, blockInfo=%s, bufLen=%d)\n",
			rmdNext.TlfID(), info, len(readyBlockData.Buf))
	} else {
		err := config.BlockServer().Put(
			ctx, rmdNext.TlfID(), info.ID, info.BlockContext,
			readyBlockData.Buf, readyBlockData.ServerHalf)
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
