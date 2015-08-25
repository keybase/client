// Keybase file system

package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	"bazil.org/fuse"

	"github.com/keybase/kbfs/libfuse"
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
var serverRootDirFlag = flag.String("server-root", "", "directory to put local server files (default is cwd)")
var serverInMemoryFlag = flag.Bool("server-in-memory", false, "use in-memory server (and ignore -server-root)")
var debug = flag.Bool("debug", false, "Print debug messages")
var version = flag.Bool("version", false, "Print version")

const usageStr = `Usage:
  kbfsfuse [-client | -local [-localuser=<user>]] [-debug]
    [-server-in-memory|-server-root=path/to/dir] /path/to/mountpoint

`

func realMain() error {
	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.Version)
		return nil
	}

	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		return errors.New("no mount specified")
	}

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		return errors.New("either -client or -local must be used")
	}

	if *debug {
		fuse.Debug = func(msg interface{}) {
			log.Printf("FUSE: %s\n", msg)
		}
	}

	var serverRootDir *string
	if !*serverInMemoryFlag {
		serverRootDir = serverRootDirFlag
	}

	mountpoint := flag.Arg(0)
	c, err := fuse.Mount(mountpoint)
	if err != nil {
		return err
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

	config, err := libkbfs.Init(localUser, serverRootDir, *cpuprofile,
		*memprofile, onInterruptFn, *debug)
	if err != nil {
		return err
	}

	defer libkbfs.Shutdown(*memprofile)

	fs := libfuse.NewFS(config, c)
	ctx := context.WithValue(context.Background(), libfuse.CtxAppIDKey, fs)
	fs.Serve(ctx)

	// Check if the mount process has an error to report.
	<-c.Ready
	err = c.MountError
	if err != nil {
		return err
	}

	return nil
}

func main() {
	err := realMain()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsfuse: %s\n", err)
		os.Exit(1)
	}
	os.Exit(0)
}
