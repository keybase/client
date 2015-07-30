// Keybase file system

package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"

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

// Define this so deferred functions get executed before exit.
func realMain() (err error, exitStatus int) {
	defer func() {
		if err != nil && exitStatus == 0 {
			exitStatus = 1
		}
	}()

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
		err = errors.New("either -client or -local must be used")
		return
	}

	if *debug {
		fuse.Debug = func(msg interface{}) {
			log.Printf("FUSE: %s\n", msg)
		}
	}

	mountpoint := flag.Arg(0)
	c, err := fuse.Mount(mountpoint)
	if err != nil {
		return
	}
	defer c.Close()

	onInterruptFn := func() {
		select {
		case <-c.Ready:
			// mountpoint was mounted, so try to unmount
			// if it was successful.
			if c.MountError == nil {
				err = fuse.Unmount(mountpoint)
				if err != nil {
					return
				}
			}

		default:
			// mountpoint was not mounted successfully
			// yet, so do nothing. Note that the mount
			// could still happen, but that's a rare
			// enough edge case.
		}
	}

	config, err := libkbfs.Init(localUser, *serverRootDir, *cpuprofile, *memprofile, onInterruptFn)
	if err != nil {
		return
	}

	defer libkbfs.Shutdown(*memprofile)

	filesys := &FS{
		config: config,
		conn:   c,
	}
	ctx := context.WithValue(context.Background(), ctxAppIDKey, filesys)

	srv := fs.New(c, &fs.Config{
		GetContext: func() context.Context {
			return ctx
		},
	})
	filesys.fuse = srv

	// Blocks forever, unless an interrupt signal is received
	// (handled by libkbfs.Init).
	err = srv.Serve(filesys)
	if err != nil {
		return
	}

	// Check if the mount process has an error to report.
	<-c.Ready
	err = c.MountError
	if err != nil {
		return
	}

	return
}

func main() {
	err, exitstatus := realMain()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsfuse: %s\n", err)
	}
	os.Exit(exitstatus)
}
