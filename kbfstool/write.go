// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type nodeWriter struct {
	ctx     context.Context
	kbfsOps libkbfs.KBFSOps
	node    libkbfs.Node
	off     int64
	verbose bool
}

var _ io.Writer = (*nodeWriter)(nil)

func (nw *nodeWriter) Write(p []byte) (n int, err error) {
	if nw.verbose {
		fmt.Fprintf(os.Stderr, "Writing %s at offset %d\n", byteCountStr(len(p)), nw.off)
	}
	err = nw.kbfsOps.Write(nw.ctx, nw.node, p, nw.off)
	if err == nil {
		n = len(p)
		nw.off += int64(n)
	}
	return
}

func writeHelper(ctx context.Context, config libkbfs.Config, args []string) (err error) {
	flags := flag.NewFlagSet("kbfs write", flag.ContinueOnError)
	append := flags.Bool("a", false, "Append to an existing file instead of truncating it.")
	verbose := flags.Bool("v", false, "Print extra status output.")
	err = flags.Parse(args)
	if err != nil {
		return err
	}

	if flags.NArg() != 1 {
		return errExactlyOnePath
	}

	filePathStr := flags.Arg(0)

	defer func() {
		if err != nil {
			if _, ok := err.(cannotWriteErr); !ok {
				err = cannotWriteErr{filePathStr, err}
			}
		}
	}()

	p, err := fsrpc.NewPath(filePathStr)
	if err != nil {
		return
	}

	if p.PathType != fsrpc.TLFPathType {
		err = cannotWriteErr{filePathStr, nil}
		return
	}

	dir, filename, err := p.DirAndBasename()
	if err != nil {
		return
	}

	if dir.PathType != fsrpc.TLFPathType {
		err = cannotWriteErr{filePathStr, nil}
		return
	}

	parentNode, err := dir.GetDirNode(ctx, config)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()

	noSuchFileErr := libkbfs.NoSuchNameError{Name: filename}

	// The operations below are racy, but that is inherent to a
	// distributed FS.

	fileNode, de, err := kbfsOps.Lookup(ctx, parentNode, filename)
	if err != nil && err != noSuchFileErr {
		return err
	}

	needSync := false
	var off int64

	if err == noSuchFileErr {
		if *verbose {
			fmt.Fprintf(os.Stderr, "Creating %s\n", p)
		}
		fileNode, _, err = kbfsOps.CreateFile(ctx, parentNode, filename, false, libkbfs.NoExcl)
		if err != nil {
			return err
		}
	} else {
		if *append {
			if *verbose {
				fmt.Fprintf(os.Stderr, "Appending to %s\n", p)
			}

			off = int64(de.Size)
		} else {
			if *verbose {
				fmt.Fprintf(os.Stderr, "Truncating %s\n", p)
			}
			err = kbfsOps.Truncate(ctx, fileNode, 0)
			if err != nil {
				return err
			}

			needSync = true
		}
	}

	nw := nodeWriter{
		ctx:     ctx,
		kbfsOps: kbfsOps,
		node:    fileNode,
		off:     off,
		verbose: *verbose,
	}

	written, err := io.Copy(&nw, os.Stdin)
	if err != nil {
		return err
	}

	if written > 0 {
		needSync = true
	}

	if needSync {
		if *verbose {
			fmt.Fprintf(os.Stderr, "Syncing %s\n", p)
		}
		err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
		if err != nil {
			return err
		}
	}

	return nil
}

func write(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	err := writeHelper(ctx, config, args)
	if err != nil {
		printError("write", err)
		exitStatus = 1
	}
	return
}
