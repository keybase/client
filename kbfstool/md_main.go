package main

import (
	"fmt"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const mdUsageStr = `Usage:
  kbfstool md [<subcommand>] [<args>]

The possible subcommands are:
  dump		Dump metadata objects
  check		Check metadata objects and their associated blocks for errors

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
	default:
		printError("md", fmt.Errorf("unknown command '%s'", cmd))
		return 1
	}
}
