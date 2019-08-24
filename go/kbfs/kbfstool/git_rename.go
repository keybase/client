package main

import (
	"flag"
	"fmt"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/fsrpc"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

const gitRenameUsageStr = `Usage:
  kbfstool git rename /keybase/tlf/path oldName newName
`

func doGitRename(ctx context.Context,
	rpcHandler *libgit.RPCHandler, tlfStr, oldName, newName string) error {
	p, err := fsrpc.NewPath(tlfStr)
	if err != nil {
		return err
	}
	if p.PathType != fsrpc.TLFPathType {
		return fmt.Errorf("%q is not a TLF path", tlfStr)
	}
	if len(p.TLFComponents) > 0 {
		return fmt.Errorf("%q is not the root path of a TLF", tlfStr)
	}
	folder := keybase1.FolderHandle{
		Name:       p.TLFName,
		FolderType: p.TLFType.FolderType(),
	}

	return rpcHandler.RenameRepo(ctx, folder, oldName, newName)
}

func gitRename(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs git rename", flag.ContinueOnError)
	err := flags.Parse(args)
	if err != nil {
		printError("git rename", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) != 3 {
		fmt.Print(gitRenameUsageStr)
		return 1
	}

	kbfsCtx := env.NewContext()
	rpcHandler, shutdown := libgit.NewRPCHandlerWithCtx(kbfsCtx, config, nil)
	defer shutdown()

	err = doGitRename(ctx, rpcHandler, inputs[0], inputs[1], inputs[2])
	if err != nil {
		printError("git rename", err)
		return 1
	}

	return 0
}
