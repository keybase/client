// Keybase file system

package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

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
var serverRootDir = flag.String("server-root", "", "directory to put local server files (default is cwd)")
var debug = flag.Bool("debug", false, "Print FUSE debug messages")

const usageStr = `Usage:
  kbfsfuse [-client | -local [-localuser=<user>]] [-debug]
    [-server-root=path/to/dir] /path/to/mountpoint

`

func printError(prefix string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %s\n", prefix, err)
}

// Define this so deferred functions get executed before exit.
func realMain() (exitStatus int) {
	flag.Parse()
	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		exitStatus = 1
		return
	}

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		printError("kbfsfuse", errors.New("either -client or -local must be used"))
		exitStatus = 1
		return
	}

	mountpoint := flag.Arg(0)
	config, err := libkbfs.Init(localUser, *serverRootDir, *cpuprofile, *memprofile, func() {
		// TODO: Only try to unmount if the mount process
		// finished successfully.
		err := fuse.Unmount(mountpoint)
		if err != nil {
			log.Print(err)
		}
	})
	if err != nil {
		printError("kbfsfuse", err)
		exitStatus = 1
		return
	}

	defer libkbfs.Shutdown(*memprofile)

	ctx := context.Background()
	// Blocks forever, unless an interrupt/kill signal is received
	// (handled by libkbfs.Init) or there was a mount error.
	if err := runNewFUSE(ctx, config, *debug, mountpoint); err != nil {
		log.Fatalf("error serving filesystem: %v", err)
		printError("kbfsfuse", err)
		exitStatus = 1
		return
	}

	return
}

func main() {
	os.Exit(realMain())
}
