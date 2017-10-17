// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Git remote helper for the Keybase file system.

package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfsgit"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libgit"
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

func checkService(kbCtx env.Context) *libfs.Error {
	// Trying to dial the service seems like the best
	// platform-agnostic way of seeing if the service is up.  Stat-ing
	// the socket file, for example, doesn't work for Windows named
	// pipes.
	s, err := libkb.NewSocket(kbCtx.GetGlobalContext())
	if err != nil {
		return libfs.InitError(err.Error())
	}
	c, err := s.DialSocket()
	if err != nil {
		if runtime.GOOS == "darwin" || runtime.GOOS == "windows" {
			return libfs.InitError(
				"Keybase isn't running. Open the Keybase app.")
		}
		return libfs.InitError(
			"Keybase isn't running. Try `run_keybase`.")
	}
	err = c.Close()
	if err != nil {
		return libfs.InitError(err.Error())
	}
	return nil
}

func start() (startErr *libfs.Error) {
	kbCtx := env.NewContext()

	switch kbCtx.GetRunMode() {
	case libkb.ProductionRunMode:
	case libkb.StagingRunMode:
		fmt.Fprintf(os.Stderr, "Running in staging mode\n")
	case libkb.DevelRunMode:
		fmt.Fprintf(os.Stderr, "Running in devel mode\n")
	default:
		panic(fmt.Sprintf("Unexpected run mode: %s", kbCtx.GetRunMode()))
	}

	defaultParams, storageRoot, err := libgit.Params(kbCtx,
		kbCtx.GetDataDir(), nil)
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
	defaultLogPath := filepath.Join(kbCtx.GetLogDir(), libkb.GitLogFileName)

	// Make sure the service is running before blocking on a connection to it.
	startErr = checkService(kbCtx)
	if startErr != nil {
		return startErr
	}

	// Duplicate the stderr fd, so that when the logger closes it when
	// redirecting log messages to a file, we will still be able to
	// write status updates back to the git process.
	stderrFile, err := dupStderr()
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer stderrFile.Close()

	defer func() {
		// Now that the stderr has been duplicated, print all errors
		// to the duplicate as well as to the new `os.Stderr` down in
		// `main()`, so that the error shows up both in the log and to
		// the user.
		if startErr != nil {
			fmt.Fprintf(stderrFile, "git-remote-keybase error: (%d) %s\n",
				startErr.Code, startErr.Message)
		}
	}()

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
	runMode := os.Getenv("KEYBASE_RUN_MODE")
	if len(runMode) == 0 {
		// Default to prod.
		os.Setenv("KEYBASE_RUN_MODE", "prod")
	}

	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "git-remote-keybase error: (%d) %s\n",
			err.Code, err.Message)
		os.Exit(err.Code)
	}
	os.Exit(0)
}
