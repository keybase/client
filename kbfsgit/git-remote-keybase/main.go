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
	"github.com/pkg/errors"
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

func getLocalGitDir() (gitDir string, err error) {
	gitDir = os.Getenv("GIT_DIR")
	fi, err := os.Stat(gitDir)
	if err != nil {
		return "", err
	}
	if !fi.IsDir() {
		return "", errors.Errorf("GIT_DIR=%s, but is not a dir", gitDir)
	}
	// On Windows, git annoyingly puts normal slashes in the
	// environment variable.
	return filepath.FromSlash(gitDir), nil
}

func start() *libfs.Error {
	kbCtx := env.NewContext()

	// TODO: Also remove all kbfsgit directories older than 24h.
	storageRoot, err := ioutil.TempDir(kbCtx.GetDataDir(), "kbfsgit")
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer func() {
		rmErr := os.RemoveAll(storageRoot)
		if rmErr != nil {
			fmt.Fprintf(os.Stderr,
				"Error cleaning storage dir %s: %+v\n", storageRoot, rmErr)
		}
	}()

	defaultParams := libkbfs.DefaultInitParams(kbCtx)
	defaultParams.LogToFile = true
	defaultParams.Debug = true
	defaultParams.EnableDiskCache = false
	defaultParams.StorageRoot = storageRoot
	defaultParams.Mode = libkbfs.InitSingleOpString
	defaultParams.TLFJournalBackgroundWorkStatus =
		libkbfs.TLFJournalSingleOpBackgroundWorkEnabled
	defaultLogPath := filepath.Join(
		kbCtx.GetLogDir(), libkb.GitLogFileName)

	// Duplicate the stderr fd, so that when the logger closes it when
	// redirecting log messages to a file, we will still be able to
	// write status updates back to the git process.
	stderrFile, err := dupStderr()
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer stderrFile.Close()

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

	gitDir, err := getLocalGitDir()
	if err != nil {
		return libfs.InitError(err.Error())
	}

	options := kbfsgit.StartOptions{
		KbfsParams: *kbfsParams,
		Remote:     remote,
		Repo:       repo,
		GitDir:     gitDir,
	}

	ctx := context.Background()
	return kbfsgit.Start(
		ctx, options, kbCtx, defaultLogPath, os.Stdin, os.Stdout, stderrFile)
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
