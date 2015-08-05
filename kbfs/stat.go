package main

import (
	"flag"
	"fmt"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func statNode(ctx context.Context, config libkbfs.Config, nodePathStr string) error {
	p, err := makeKbfsPath(nodePathStr)
	if err != nil {
		return err
	}

	n, de, err := p.getNode(ctx, config)
	if err != nil {
		return err
	}

	// If n is non-nil, ignore the DirEntry returned by
	// p.getNode() so we can exercise the Stat() codepath. We
	// can't compare the two, since they might legitimately differ
	// due to races.
	if n != nil {
		de, err = config.KBFSOps().Stat(ctx, n)
		if err != nil {
			return err
		}
	}

	var symPathStr string
	if de.Type == libkbfs.Sym {
		symPathStr = fmt.Sprintf("SymPath: %s, ", de.SymPath)
	}

	mtimeStr := time.Unix(0, de.Mtime).String()
	ctimeStr := time.Unix(0, de.Ctime).String()

	fmt.Printf("{Type: %s, Size: %d, %sMtime: %s, Ctime: %s}\n", de.Type, de.Size, symPathStr, mtimeStr, ctimeStr)

	return nil
}

func stat(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs stat", flag.ContinueOnError)
	flags.Parse(args)

	nodePaths := flags.Args()
	if len(nodePaths) == 0 {
		printError("stat", errAtLeastOnePath)
		exitStatus = 1
		return
	}

	for _, nodePath := range nodePaths {
		err := statNode(ctx, config, nodePath)
		if err != nil {
			printError("stat", err)
			exitStatus = 1
		}
	}
	return
}
