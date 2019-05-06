// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

// Keybase file system

package main

import (
	"flag"
	"fmt"
	"os"

	"bazil.org/fuse"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libfuse"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
)

var runtimeDir = flag.String("runtime-dir", os.Getenv("KEYBASE_RUNTIME_DIR"), "runtime directory")
var label = flag.String("label", os.Getenv("KEYBASE_LABEL"), "label to help identify if running as a service")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force, none")
var version = flag.Bool("version", false, "Print version")

const usageFormatStr = `Usage:
  kbfsfuse -version

To run against remote KBFS servers:
  kbfsfuse
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=default|force|required|none]
%s
    %s[/path/to/mountpoint]

To run in a local testing environment:
  kbfsfuse
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=default|force|required|none]
%s
    %s[/path/to/mountpoint]

Defaults:
%s `

func getUsageString(ctx libkbfs.Context) string {
	remoteUsageStr := libkbfs.GetRemoteUsageString()
	localUsageStr := libkbfs.GetLocalUsageString()
	platformUsageStr := libfuse.GetPlatformUsageString()
	defaultUsageStr := libkbfs.GetDefaultsUsageString(ctx)
	return fmt.Sprintf(usageFormatStr,
		remoteUsageStr, platformUsageStr,
		localUsageStr, platformUsageStr, defaultUsageStr)
}

func start() *libfs.Error {
	ctx := env.NewContext()

	kbfsParams := libkbfs.AddFlags(flag.CommandLine, ctx)
	platformParams := libfuse.AddPlatformFlags(flag.CommandLine)

	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.VersionString())
		return nil
	}

	mountDir := ""
	if len(flag.Args()) < 1 {
		var err error
		mountDir, err = ctx.GetMountDir()
		if err != nil {
			return libfs.InitError(err.Error())
		}
		// If a mountdir was not set by `keybase config set mountdir`, the
		// service returns a default value which may or may not exist yet.
		if len(mountDir) == 0 {
			fmt.Print(getUsageString(ctx))
			return libfs.InitError("no mount specified")
		}
	} else {
		mountDir = flag.Arg(0)
	}

	if len(flag.Args()) > 1 {
		fmt.Print(getUsageString(ctx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	if kbfsParams.Debug {
		// Temporary, until we make a config and can make a vlogger.
		fuseLog := logger.NewWithCallDepth("FUSE", 1)
		fuseLog.Configure("", true, "")
		fuse.Debug = libfuse.MakeFuseDebugFn(
			fuseLog, false /* superVerbose */)
	}

	logger.EnableBufferedLogging()
	defer logger.Shutdown()

	options := libfuse.StartOptions{
		KbfsParams:        *kbfsParams,
		PlatformParams:    *platformParams,
		RuntimeDir:        *runtimeDir,
		Label:             *label,
		ForceMount:        *mountType == "force" || *mountType == "required",
		MountErrorIsFatal: *mountType == "required",
		SkipMount:         *mountType == "none",
		MountPoint:        mountDir,
	}

	return libfuse.Start(options, ctx)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsfuse error: (%d) %s\n", err.Code, err.Message)

		os.Exit(err.Code)
	}
	os.Exit(0)
}
