package main

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const mdUsageStr = `Usage:
  kbfstool md [<subcommand>] [<args>]

The possible subcommands are:
  dump	      Dump metadata objects
  check	      Check metadata objects and their associated blocks for errors
  reset	      Reset a broken top-level folder
  force-qr    Append a fake quota reclamation record to the folder history
`

func mdMain(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	if len(args) < 1 {
		fmt.Print(mdUsageStr)
		return 1
	}

	cmd := args[0]
	args = args[1:]

	switch cmd {
	case "dump":
		return mdDump(ctx, config, args)
	case "check":
		return mdCheck(ctx, config, args)
	case "reset":
		return mdReset(ctx, config, args)
	case "force-qr":
		return mdForceQR(ctx, config, args)
	default:
		printError("md", fmt.Errorf("unknown command %q", cmd))
		return 1
	}
}
