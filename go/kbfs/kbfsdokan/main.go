// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Keybase file system

package main

import (
	"flag"
	"fmt"
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libdokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"os"
	"strconv"
)

func getDefaultMountFlags() int64 {
	mf := os.Getenv("KEYBASE_MOUNT_FLAGS")
	if mf == "" {
		return int64(libdokan.DefaultMountFlags)
	}
	iv, _ := strconv.Atoi(mf)
	return int64(iv)
}

var runtimeDir = flag.String("runtime-dir", os.Getenv("KEYBASE_RUNTIME_DIR"), "runtime directory")
var label = flag.String("label", os.Getenv("KEYBASE_LABEL"), "label to help identify if running as a service")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force, none")
var version = flag.Bool("version", false, "Print version")
var mountFlags = flag.Int64("mount-flags", getDefaultMountFlags(), "Dokan mount flags")
var dokandll = flag.String("dokan-dll", "", "Absolute path of dokan dll to load")
var servicemount = flag.Bool("mount-from-service", false, "get mount path from service")

const usageFormatStr = `Usage:
  kbfsdokan -version

To run against remote KBFS servers:
  kbfsdokan
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
    [-mount-flags=n] [-dokan-dll=path/to/dokan.dll]
%s
    -mount-from-service | /path/to/mountpoint

To run in a local testing environment:
  kbfsdokan
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
    [-mount-flags=n] [-dokan-dll=path/to/dokan.dll]
%s
    -mount-from-service | /path/to/mountpoint

Defaults:
%s
`

func getUsageString(ctx libkbfs.Context) string {
	remoteUsageStr := libkbfs.GetRemoteUsageString()
	localUsageStr := libkbfs.GetLocalUsageString()
	defaultUsageStr := libkbfs.GetDefaultsUsageString(ctx)
	return fmt.Sprintf(usageFormatStr, remoteUsageStr,
		localUsageStr, defaultUsageStr)
}

func start() *libfs.Error {
	err := libkb.SaferDLLLoading()
	if err != nil {
		fmt.Printf("SaferDLLLoading failed: %v\n", err)
	}

	ctx := env.NewContextWithPerfLog(libkb.KBFSPerfLogFileName)
	kbfsParams := libkbfs.AddFlags(flag.CommandLine, ctx)

	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.VersionString())
		return nil
	}

	var mountpoint string
	if len(flag.Args()) < 1 {
		if !*servicemount {
			fmt.Print(getUsageString(ctx))
			return libfs.InitError("no mount specified")
		}
	} else {
		mountpoint = flag.Arg(0)
	}

	if len(flag.Args()) > 1 {
		fmt.Print(getUsageString(ctx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	logger.EnableBufferedLogging()
	defer logger.Shutdown()

	options := libdokan.StartOptions{
		KbfsParams: *kbfsParams,
		RuntimeDir: *runtimeDir,
		Label:      *label,
		DokanConfig: dokan.Config{
			MountFlags: dokan.MountFlag(*mountFlags),
			DllPath:    *dokandll,
		},
		ForceMount: *mountType == "force",
		SkipMount:  *mountType == "none",
		MountPoint: mountpoint,
	}

	return libdokan.Start(options, ctx)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsdokan error: (%d) %s\n", err.Code, err.Message)

		os.Exit(err.Code)
	}
	fmt.Fprintf(os.Stderr, "kbfsdokan normal shutdown")
	os.Exit(0)
}
