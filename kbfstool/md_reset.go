package main

import (
	"flag"
	"fmt"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdResetOne(ctx context.Context, config libkbfs.Config,
	rmd libkbfs.ImmutableRootMetadata) error {
	// create a dblock since one doesn't exist yet
	username, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}

	handle := rmd.GetTlfHandle()

	// make sure we're a writer before rekeying or putting any blocks.
	if !handle.IsWriter(uid) {
		return libkbfs.NewWriteAccessError(
			handle, username, handle.GetCanonicalPath())
	}

	_, err = rmd.MakeSuccessor(config.Codec(), rmd.MdID(), true)
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

	input := inputs[0]
	irmd, err := mdParseAndGet(ctx, config, input)
	if err != nil {
		printError("md reset", err)
		return 1
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		fmt.Printf("No result found for %q\n\n", input)
		return 0
	}

	err = mdResetOne(ctx, config, irmd)
	if err != nil {
		printError("md reset", err)
		return 1
	}

	fmt.Print("\n")

	return 0
}
