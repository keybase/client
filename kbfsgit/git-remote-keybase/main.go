// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Git remote helper for the Keybase file system.

package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfsgit"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

var version = flag.Bool("version", false, "Print version")

const usageFormatStr = `Usage:
  git-remote-keybase -version

To run against remote KBFS servers:
  git-remote-keybase %s <remote> [keybase://<repo>]

To run in a local testing environment:
  git-remote-keybase %s <remote> [keybase://<repo>]

Defaults:
%s
`

func getUsageString(ctx libkbfs.Context) string {
	remoteUsageStr := libkbfs.GetRemoteUsageString()
	localUsageStr := libkbfs.GetLocalUsageString()
	defaultUsageStr := libkbfs.GetDefaultsUsageString(ctx)
	return fmt.Sprintf(
		usageFormatStr, remoteUsageStr, localUsageStr, defaultUsageStr)
}

func start() *libfs.Error {
	kbCtx := env.NewContext()

	// TODO: Also remove all kbfsgit directories older than 24h.
	storageRoot, err := ioutil.TempDir(kbCtx.GetDataDir(), "kbfsgit")
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defaultParams := libkbfs.DefaultInitParams(kbCtx)
	defaultParams.LogToFile = true
	defaultParams.Debug = true
	defaultParams.StorageRoot = storageRoot
	defaultParams.Mode = libkbfs.InitSingleOpString
	defaultLogPath := filepath.Join(
		kbCtx.GetLogDir(), libkb.GitLogFileName)

	kbfsParams := libkbfs.AddFlagsWithDefaults(
		flag.CommandLine, defaultParams, defaultLogPath)
	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.VersionString())
		return nil
	}

	if len(flag.Args()) < 1 {
		fmt.Print(getUsageString(kbCtx))
		return libfs.InitError("no remote repo specified")
	}

	remote := flag.Arg(0)
	var repo string
	if len(flag.Args()) > 1 {
		repo = flag.Arg(1)
	}

	if len(flag.Args()) > 2 {
		fmt.Print(getUsageString(kbCtx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	options := kbfsgit.StartOptions{
		KbfsParams: *kbfsParams,
		Remote:     remote,
		Repo:       repo,
	}

	ctx := context.Background()
	return kbfsgit.Start(
		ctx, options, kbCtx, defaultLogPath, os.Stdin, os.Stdout)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "git-remote-keybase error: (%d) %s\n",
			err.Code, err.Message)
		os.Exit(err.Code)
	}
	os.Exit(0)
}
