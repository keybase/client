// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/fsrpc"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func statNode(ctx context.Context, config libkbfs.Config, nodePathStr string) error {
	p, err := fsrpc.NewPath(nodePathStr)
	if err != nil {
		return err
	}

	n, ei, err := p.GetNode(ctx, config)
	if err != nil {
		return err
	}

	// If n is non-nil, ignore the EntryInfo returned by
	// p.getNode() so we can exercise the Stat() codepath. We
	// can't compare the two, since they might legitimately differ
	// due to races.
	if n != nil {
		ei, err = config.KBFSOps().Stat(ctx, n)
		if err != nil {
			return err
		}
	}

	var symPathStr string
	if ei.Type == data.Sym {
		symPathStr = fmt.Sprintf("SymPath: %s, ", ei.SymPath)
	}

	mtimeStr := time.Unix(0, ei.Mtime).String()
	ctimeStr := time.Unix(0, ei.Ctime).String()

	fmt.Printf("{Type: %s, Size: %d, %sMtime: %s, Ctime: %s}\n", ei.Type, ei.Size, symPathStr, mtimeStr, ctimeStr)

	return nil
}

func stat(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs stat", flag.ContinueOnError)
	err := flags.Parse(args)
	if err != nil {
		printError("stat", err)
		return 1
	}

	nodePaths := flags.Args()
	if len(nodePaths) == 0 {
		printError("stat", errAtLeastOnePath)
		return 1
	}

	for _, nodePath := range nodePaths {
		err := statNode(ctx, config, nodePath)
		if err != nil {
			printError("stat", err)
			return 1
		}
	}

	return 0
}
