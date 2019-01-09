package main

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const gitUsageStr = `Usage:
  kbfstool git [<subcommand>] [<args>]

The possible subcommands are:
  rename	Rename a git repository
`

func gitMain(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	if len(args) < 1 {
		fmt.Print(gitUsageStr)
		return 1
	}

	cmd := args[0]
	args = args[1:]

	switch cmd {
	case "rename":
		return gitRename(ctx, config, args)
	default:
		printError("git", fmt.Errorf("unknown command %q", cmd))
		return 1
	}
}
