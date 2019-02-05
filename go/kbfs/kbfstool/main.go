// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
)

var version = flag.Bool("version", false, "Print version")

const usageFormatStr = `Usage:
  kbfstool -version

To run against remote KBFS servers:
  kbfstool
%s
    <command> [<args>]

To run in a local testing environment:
  kbfstool
%s
    <command> [<args>]

Defaults:
%s

The possible commands are:
  stat		Display file status
  ls		List directory contents
  mkdir		Make directories
  read		Dump file to stdout
  write		Write stdin to file
  md            Operate on metadata objects
  git           Operate on git repositories

`

func getUsageString(ctx libkbfs.Context) string {
	remoteUsageStr := libkbfs.GetRemoteUsageString()
	localUsageStr := libkbfs.GetLocalUsageString()
	defaultUsageStr := libkbfs.GetDefaultsUsageString(ctx)
	return fmt.Sprintf(usageFormatStr, remoteUsageStr,
		localUsageStr, defaultUsageStr)
}

// Define this so deferred functions get executed before exit.
func realMain() (exitStatus int) {
	kbCtx := env.NewContext()
	kbfsParams := libkbfs.AddFlags(flag.CommandLine, kbCtx)

	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.VersionString())
		return 0
	}

	if len(flag.Args()) < 1 {
		fmt.Print(getUsageString(kbCtx))
		return 1
	}

	log := logger.New("")

	tempDir, err := ioutil.TempDir(kbCtx.GetDataDir(), "kbfstool")
	if err != nil {
		panic(err.Error())
	}
	defer func() {
		rmErr := os.RemoveAll(tempDir)
		if rmErr != nil {
			fmt.Fprintf(os.Stderr,
				"Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
		}
	}()

	// Turn these off, and use a temp dir for the storage root, to not
	// interfere with a running kbfs daemon.
	kbfsParams.EnableJournal = false
	kbfsParams.DiskCacheMode = libkbfs.DiskCacheModeOff
	kbfsParams.Mode = libkbfs.InitSingleOpString
	kbfsParams.StorageRoot = tempDir

	ctx := context.Background()
	config, err := libkbfs.Init(ctx, kbCtx, *kbfsParams, nil, nil, log)
	if err != nil {
		printError("kbfs", err)
		return 1
	}

	defer libkbfs.Shutdown()

	// TODO: Make the logging level WARNING instead of INFO, or
	// figure out some other way to log the full folder-branch
	// name for kbfsfuse but not for kbfs.

	cmd := flag.Arg(0)
	args := flag.Args()[1:]

	switch cmd {
	case "stat":
		return stat(ctx, config, args)
	case "ls":
		return ls(ctx, config, args)
	case "mkdir":
		return mkdir(ctx, config, args)
	case "read":
		return read(ctx, config, args)
	case "write":
		return write(ctx, config, args)
	case "md":
		return mdMain(ctx, config, args)
	case "git":
		return gitMain(ctx, config, args)
	default:
		printError("kbfs", fmt.Errorf("unknown command %q", cmd))
		return 1
	}
}

func main() {
	os.Exit(realMain())
}
