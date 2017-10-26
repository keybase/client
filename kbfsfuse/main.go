// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Keybase file system

package main

import (
	"flag"
	"fmt"
	"os"

	"bazil.org/fuse"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libfuse"
	"github.com/keybase/kbfs/libkbfs"
)

var runtimeDir = flag.String("runtime-dir", os.Getenv("KEYBASE_RUNTIME_DIR"), "runtime directory")
var label = flag.String("label", os.Getenv("KEYBASE_LABEL"), "label to help identify if running as a service")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force, none")
var version = flag.Bool("version", false, "Print version")

const usageFormatStr = `Usage:
  kbfsfuse -version

To run against remote KBFS servers:
  kbfsfuse
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
%s
    %s/path/to/mountpoint

To run in a local testing environment:
  kbfsfuse
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
%s
    %s/path/to/mountpoint

Defaults:
%s
`

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

	if len(flag.Args()) < 1 {
		fmt.Print(getUsageString(ctx))
		return libfs.InitError("no mount specified")
	}

	if len(flag.Args()) > 1 {
		fmt.Print(getUsageString(ctx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	if kbfsParams.Debug {
		fuseLog := logger.NewWithCallDepth("FUSE", 1)
		fuseLog.Configure("", true, "")
		fuse.Debug = libfuse.MakeFuseDebugFn(
			fuseLog, false /* superVerbose */)
	}

	options := libfuse.StartOptions{
		KbfsParams:     *kbfsParams,
		PlatformParams: *platformParams,
		RuntimeDir:     *runtimeDir,
		Label:          *label,
		ForceMount:     *mountType == "force",
		SkipMount:      *mountType == "none",
		MountPoint:     flag.Arg(0),
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
