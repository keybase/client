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
	"strings"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/kbfsgit"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/stderrutils"
	"github.com/keybase/client/go/libkb"
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

func getLocalGitDir() (gitDir string) {
	gitDir = os.Getenv("GIT_DIR")
	// On Windows, git annoyingly puts normal slashes in the
	// environment variable.
	return filepath.FromSlash(gitDir)
}

func start() (startErr *libfs.Error) {
	kbCtx := env.NewContextWithPerfLog(libkb.GitPerfLogFileName)

	switch kbCtx.GetRunMode() {
	case kbconst.ProductionRunMode:
	case kbconst.StagingRunMode:
		fmt.Fprintf(os.Stderr, "Running in staging mode\n")
	case kbconst.DevelRunMode:
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
	err = kbCtx.CheckService()
	if err != nil {
		startErr = libfs.InitError(err.Error())
		return startErr
	}

	// Duplicate the stderr fd, so that when the logger closes it when
	// redirecting log messages to a file, we will still be able to
	// write status updates back to the git process.
	stderrFile, err := stderrutils.DupStderr()
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
	lfs := false
	if len(flag.Args()) > 1 && remote != "lfs" {
		repo = flag.Arg(1)
	} else if remote == "lfs" && len(flag.Args()) == 3 {
		lfs = true
		remote = flag.Arg(1)
		repo = flag.Arg(2)
	} else {
		// For LFS invocation, on some systems/shells the arguments
		// actually come together in a single quoted argument for some
		// reason.
		s := strings.Fields(remote)
		if len(s) > 2 {
			lfs = s[0] == "lfs"
			remote = s[1]
			repo = s[2]
		}
	}

	if !lfs && len(flag.Args()) > 2 {
		fmt.Print(getUsageString(kbCtx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	if lfs {
		// For LFS uploads we should be flushing the journal
		// constantly, so we don't build up a huge batch of data that
		// conflict resolution can't handle.  (See HOTPOT-1554.)
		kbfsParams.TLFJournalBackgroundWorkStatus =
			libkbfs.TLFJournalBackgroundWorkEnabled
	}

	options := kbfsgit.StartOptions{
		KbfsParams: *kbfsParams,
		Remote:     remote,
		Repo:       repo,
		GitDir:     getLocalGitDir(),
		LFS:        lfs,
	}

	ctx := context.Background()
	return kbfsgit.Start(
		ctx, options, kbCtx, defaultLogPath, os.Stdin, os.Stdout,
		stderrFile)
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
