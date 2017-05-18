// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func maybePrintPath(path string, err error, verbose bool) {
	if err == nil && verbose {
		fmt.Fprintf(os.Stderr, "mkdir: created directory '%s'\n", path)
	}
}

func createDir(ctx context.Context, kbfsOps libkbfs.KBFSOps, parentNode libkbfs.Node, dirname, path string, verbose bool) (libkbfs.Node, error) {
	childNode, _, err := kbfsOps.CreateDir(ctx, parentNode, dirname)
	maybePrintPath(path, err, verbose)
	return childNode, err
}

func mkdirOne(ctx context.Context, config libkbfs.Config, dirPathStr string, createIntermediate, verbose bool) error {
	p, err := fsrpc.NewPath(dirPathStr)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()

	if createIntermediate {
		if p.PathType != fsrpc.TLFPathType || len(p.TLFComponents) == 0 {
			// Nothing to do.
			return nil
		}

		tlfRoot := fsrpc.Path{
			PathType: fsrpc.TLFPathType,
			TLFType:  p.TLFType,
			TLFName:  p.TLFName,
		}
		tlfNode, err := tlfRoot.GetDirNode(ctx, config)
		if err != nil {
			return err
		}

		currP := tlfRoot
		currNode := tlfNode
		for i := 0; i < len(p.TLFComponents); i++ {
			dirname := p.TLFComponents[i]
			currP, err = currP.Join(dirname)
			if err != nil {
				return err
			}

			nextNode, err := createDir(ctx, kbfsOps, currNode, dirname, currP.String(), verbose)
			if err == (libkbfs.NameExistsError{Name: dirname}) {
				nextNode, _, err = kbfsOps.Lookup(ctx, currNode, dirname)
			}
			if err != nil {
				return err
			}
			currNode = nextNode
		}
	} else {
		if p.PathType != fsrpc.TLFPathType {
			return libkbfs.NameExistsError{Name: p.String()}
		}

		parentDir, dirname, err := p.DirAndBasename()
		if err != nil {
			return err
		}

		if parentDir.PathType != fsrpc.TLFPathType {
			// TODO: Ideally, this would error out if
			// p already existed.
			_, err := p.GetDirNode(ctx, config)
			maybePrintPath(p.String(), err, verbose)
			return err
		}

		parentNode, err := parentDir.GetDirNode(ctx, config)
		if err != nil {
			return err
		}

		_, err = createDir(ctx, kbfsOps, parentNode, dirname, p.String(), verbose)
		if err != nil {
			return err
		}
	}

	return nil
}

func mkdir(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs mkdir", flag.ContinueOnError)
	createIntermediate := flags.Bool("p", false, "Create intermediate directories as required.")
	verbose := flags.Bool("v", false, "Print extra status output.")
	err := flags.Parse(args)
	if err != nil {
		printError("mkdir", err)
		return 1
	}

	nodePaths := flags.Args()
	if len(nodePaths) == 0 {
		printError("mkdir", errAtLeastOnePath)
		return 1
	}

	for _, nodePath := range nodePaths {
		err := mkdirOne(ctx, config, nodePath, *createIntermediate, *verbose)
		if err != nil {
			printError("mkdir", err)
			exitStatus = 1
		}
	}
	return
}
