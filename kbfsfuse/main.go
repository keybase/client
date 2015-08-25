// Keybase file system

package main

import (
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// ExitStatus defines the possible program exit status codes
type exitStatus int

const (
	success      exitStatus = 0 // No error
	defaultError            = 1 // Default/generic error
	usageError              = 2 // One or more arguments are invalid
	mountError              = 3 // We were unable to mount
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
var debug = flag.Bool("debug", false, "Print FUSE debug messages")
var version = flag.Bool("version", false, "Print version")

const usageStr = `Usage:
  kbfsfuse [-client | -local [-localuser=<user>]] [-debug]
    [-server-in-memory|-server-root=path/to/dir] /path/to/mountpoint

`

// Define this so deferred functions get executed before exit.
func realMain() (exitStatus, error) {
	flag.Parse()

	if *version {
		fmt.Printf("%s\n", libkbfs.Version)
		return usageError, nil
	}

	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		return usageError, nil
	}

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		return usageError, errors.New("either -client or -local must be used")
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
		return mountError, err
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

	config, err := libkbfs.Init(localUser, serverRootDir, *cpuprofile, *memprofile, onInterruptFn)
	if err != nil {
		return defaultError, err
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

	// TODO Switch to cacheDir or runtimeDir, using serverRootDir as default for now
	version := fmt.Sprintf("%s-%s", libkbfs.Version, libkbfs.Build)
	err = ioutil.WriteFile(filepath.Join(*serverRootDir, "kbfs.version"), []byte(version), 0644)
	if err != nil {
		return defaultError, err
	}

	// Blocks forever, unless an interrupt signal is received
	// (handled by libkbfs.Init).
	err = srv.Serve(filesys)
	if err != nil {
		return defaultError, err
	}

	// Check if the mount process has an error to report.
	<-c.Ready
	err = c.MountError
	if err != nil {
		return mountError, err
	}

	return success, err
}

func main() {
	exitstatus, err := realMain()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsfuse: %s\n", err)
	}
	os.Exit(int(exitstatus))
}
