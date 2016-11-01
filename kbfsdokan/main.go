// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Keybase file system

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libdokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

var runtimeDir = flag.String("runtime-dir", os.Getenv("KEYBASE_RUNTIME_DIR"), "runtime directory")
var label = flag.String("label", os.Getenv("KEYBASE_LABEL"), "label to help identify if running as a service")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force, none")
var version = flag.Bool("version", false, "Print version")
var mountFlags = flag.Int64("mount-flags", int64(libdokan.DefaultMountFlags), "Dokan mount flags")
var dokandll = flag.String("dokan-dll", "", "Absolute path of dokan dll to load")
var servicemount = flag.Bool("service-mount", false, "get mount path from service")

const usageFormatStr = `Usage:
  kbfsdokan -version

To run against remote KBFS servers:
  kbfsdokan [-debug] [-cpuprofile=path/to/dir]
    [-bserver=%s] [-mdserver=%s]
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
    [-log-to-file] [-log-file=path/to/file]
    -service-mount | /path/to/mountpoint

To run in a local testing environment:
  kbfsdokan [-debug] [-cpuprofile=path/to/dir]
    [-server-in-memory|-server-root=path/to/dir] [-localuser=<user>]
    [-runtime-dir=path/to/dir] [-label=label] [-mount-type=force]
    [-log-to-file] [-log-file=path/to/file][-service-mount]
    -service-mount | /path/to/mountpoint

`

func getUsageStr(ctx libkbfs.Context) string {
	defaultBServer := libkbfs.GetDefaultBServer(ctx)
	if len(defaultBServer) == 0 {
		defaultBServer = "host:port"
	}
	defaultMDServer := libkbfs.GetDefaultMDServer(ctx)
	if len(defaultMDServer) == 0 {
		defaultMDServer = "host:port"
	}
	return fmt.Sprintf(usageFormatStr, defaultBServer, defaultMDServer)
}

func start() *libfs.Error {
	err := libkb.SaferDLLLoading()
	if err != nil {
		fmt.Printf("SaferDLLLoading failed: %v\n", err)
	}

	ctx := env.NewContext()
	kbfsParams := libkbfs.AddFlags(flag.CommandLine, ctx)

	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.VersionString())
		return nil
	}

	var mountpoint string
	if len(flag.Args()) < 1 {
		if !*servicemount {
			fmt.Print(getUsageStr(ctx))
			return libfs.InitError("no mount specified")
		}
	} else {
		mountpoint = flag.Arg(0)
	}

	if len(flag.Args()) > 1 {
		fmt.Print(getUsageStr(ctx))
		return libfs.InitError("extra arguments specified (flags go before the first argument)")
	}

	var mounter libdokan.Mounter
	if *mountType == "force" {
		mounter = libdokan.NewForceMounter(mountpoint)
	} else if *mountType == "none" {
		mounter = libdokan.NewNoopMounter()
	} else {
		mounter = libdokan.NewDefaultMounter(mountpoint)
	}

	options := libdokan.StartOptions{
		KbfsParams: *kbfsParams,
		RuntimeDir: *runtimeDir,
		Label:      *label,
		DokanConfig: dokan.Config{
			MountFlags: dokan.MountFlag(*mountFlags),
			DllPath:    *dokandll,
		},
	}

	return libdokan.Start(mounter, options, ctx)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsdokan error: (%d) %s\n", err.Code, err.Message)

		os.Exit(err.Code)
	}
	os.Exit(0)
}
