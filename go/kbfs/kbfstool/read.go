// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/kbfs/fsrpc"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type nodeReader struct {
	ctx     context.Context
	kbfsOps libkbfs.KBFSOps
	node    libkbfs.Node
	off     int64
	verbose bool
}

var _ io.Reader = (*nodeReader)(nil)

func (nr *nodeReader) Read(p []byte) (n int, err error) {
	if nr.verbose {
		fmt.Fprintf(os.Stderr, "Reading up to %s at offset %d\n", byteCountStr(len(p)), nr.off)
	}

	n64, err := nr.kbfsOps.Read(nr.ctx, nr.node, p, nr.off)
	nr.off += n64
	n = int(n64)
	if n64 == 0 && err == nil {
		if nr.verbose {
			fmt.Fprintf(os.Stderr, "EOF encountered\n")
		}
		err = io.EOF
	} else if nr.verbose {
		fmt.Fprintf(os.Stderr, "Read %s\n", byteCountStr(n))
	}
	return
}

func readHelper(ctx context.Context, config libkbfs.Config, args []string) error {
	flags := flag.NewFlagSet("kbfs read", flag.ContinueOnError)
	verbose := flags.Bool("v", false, "Print extra status output.")
	err := flags.Parse(args)
	if err != nil {
		return err
	}

	if flags.NArg() != 1 {
		return errExactlyOnePath
	}

	filePathStr := flags.Arg(0)
	p, err := fsrpc.NewPath(filePathStr)
	if err != nil {
		return err
	}

	if p.PathType != fsrpc.TLFPathType {
		return fmt.Errorf("Cannot read %s", p)
	}

	if *verbose {
		fmt.Fprintf(os.Stderr, "Looking up %s\n", p)
	}

	fileNode, err := p.GetFileNode(ctx, config)
	if err != nil {
		return err
	}

	nr := nodeReader{
		ctx:     ctx,
		kbfsOps: config.KBFSOps(),
		node:    fileNode,
		off:     0,
		verbose: *verbose,
	}

	_, err = io.Copy(os.Stdout, &nr)
	if err != nil {
		return err
	}

	return nil
}

func read(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	err := readHelper(ctx, config, args)
	if err != nil {
		printError("read", err)
		exitStatus = 1
	}
	return
}
