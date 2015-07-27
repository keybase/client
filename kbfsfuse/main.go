// Keybase file system

package main

import (
	"flag"
	"log"

	"bazil.org/fuse"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUserFlag = flag.String("localuser", "strib",
	"fake local user (only valid when local=true)")
var clientFlag = flag.Bool("client", false, "use keybase daemon")
var debug = flag.Bool("debug", false, "Print FUSE debug messages")

func printUsageAndExit() {
	log.Fatal("Usage:\n  kbfsfuse [-client|-local] MOUNTPOINT")
}

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		printUsageAndExit()
	}

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		printUsageAndExit()
	}

	mountpoint := flag.Arg(0)
	config, err := libkbfs.Init(localUser, *cpuprofile, *memprofile, func() {
		// TODO: Only try to unmount if the mount process
		// finished successfully.
		err := fuse.Unmount(mountpoint)
		if err != nil {
			log.Print(err)
		}
	})
	if err != nil {
		log.Fatal(err)
	}

	defer libkbfs.Shutdown(*memprofile)

	ctx := context.Background()
	if err := runNewFUSE(ctx, config, *debug, mountpoint); err != nil {
		log.Fatalf("error serving filesystem: %v", err)
	}
}
