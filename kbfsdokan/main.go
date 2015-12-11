// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

// Keybase file system

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libdokan"
	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var localUserFlag = flag.String("localuser", "", "fake local user")
var serverRootDirFlag = flag.String("server-root", "", "directory to put local server files (default is cwd)")
var serverInMemoryFlag = flag.Bool("server-in-memory", false, "use in-memory server (and ignore -server-root)")
var runtimeDir = flag.String("runtime-dir", os.Getenv("KEYBASE_RUNTIME_DIR"), "runtime directory")
var label = flag.String("label", os.Getenv("KEYBASE_LABEL"), "label to help identify if running as a service")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force")
var debug = flag.Bool("debug", false, "Print debug messages")
var version = flag.Bool("version", false, "Print version")
var bserverAddr = flag.String("bserver", defaultBServerURI, "host:port of the block server")
var mdserverAddr = flag.String("mdserver", defaultMDServerURI, "host:port of the metadata server")

const usageStr = `Usage:
  kbfsdokan [-localuser=<user>] [-debug]
    [-server-in-memory|-server-root=path/to/dir]
    [-bserver=host:port] [-mdserver=host:port] /path/to/mountpoint

`

func start() *libdokan.Error {
	flag.Parse()

	if *version {
		fmt.Printf("%s-%s\n", libkbfs.Version, libkbfs.Build)
		return nil
	}

	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		return libdokan.InitError("no mount specified")
	}

	localUser := libkb.NewNormalizedUsername(*localUserFlag)

	if *debug {
		log := logger.NewWithCallDepth("DOKAN", 1, os.Stderr)
		log.Configure("", true, "")
		//		dokan.Debug = func(msg interface{}) {
		//			log.Debug("%s", msg)
		//		}
	}

	var serverRootDir *string
	if !*serverInMemoryFlag {
		serverRootDir = serverRootDirFlag
	}

	mountpoint := flag.Arg(0)
	var mounter libdokan.Mounter
	if *mountType == "force" {
		mounter = libdokan.NewForceMounter(mountpoint)
	} else {
		mounter = libdokan.NewDefaultMounter(mountpoint)
	}

	options := libdokan.StartOptions{
		LocalUser:     localUser,
		ServerRootDir: serverRootDir,
		CPUProfile:    *cpuprofile,
		MemProfile:    *memprofile,
		RuntimeDir:    *runtimeDir,
		Label:         *label,
		Debug:         *debug,
		BServerAddr:   *bserverAddr,
		MDServerAddr:  *mdserverAddr,
	}

	return libdokan.Start(mounter, options)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsdokan error: (%d) %s\n", err.Code, err.Message)

		os.Exit(err.Code)
	}
	os.Exit(0)
}
