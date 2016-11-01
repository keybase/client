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

	fmt.Printf("Making successor to revision %d...\n",
		irmd.Revision())

	_, err = irmd.MakeSuccessor(config.Codec(), irmd.MdID(), true)
	if err != nil {
		return err
	}

	panic("not implemented")

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
