// Keybase file system

package main

import (
	"flag"
	"fmt"
	"os"

	"bazil.org/fuse"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libfuse"
	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUserFlag = flag.String("localuser", "strib",
	"fake local user (only valid when local=true)")
var clientFlag = flag.Bool("client", defaultClientFlag, "connect as client to keybase daemon")
var serverRootDirFlag = flag.String("server-root", "", "directory to put local server files (default is cwd)")
var serverInMemoryFlag = flag.Bool("server-in-memory", false, "use in-memory server (and ignore -server-root)")
var versionFile = flag.String("version-file", "", "write version to file on successful startup")
var mountType = flag.String("mount-type", defaultMountType, "mount type: default, force")
var debug = flag.Bool("debug", false, "Print debug messages")
var version = flag.Bool("version", false, "Print version")
var bserverAddr = flag.String("bserver", defaultBServerURI, "host:port of the block server")
var mdserverAddr = flag.String("mdserver", defaultMDServerURI, "host:port of the metadata server")

const usageStr = `Usage:
  kbfsfuse [-client | -local [-localuser=<user>]] [-debug]
    [-server-in-memory|-server-root=path/to/dir]
    [-bserver=host:port] [-mdserver=host:port] /path/to/mountpoint

`

func start() *libfuse.Error {
	flag.Parse()

	if *version {
		fmt.Printf("%s-%s\n", libkbfs.Version, libkbfs.Build)
		return nil
	}

	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		return libfuse.InitError("no mount specified")
	}

	var localUser libkb.NormalizedUsername
	if *local {
		localUser = libkb.NewNormalizedUsername(*localUserFlag)
	} else if *clientFlag {
		localUser = libkb.NormalizedUsername("")
	} else {
		return libfuse.InitError("either -client or -local must be used")
	}

	if *debug {
		log := logger.NewWithCallDepth("FUSE", 1)
		log.Configure("", true, "")
		fuse.Debug = func(msg interface{}) {
			log.Debug("%s", msg)
		}
	}

	var serverRootDir *string
	if !*serverInMemoryFlag {
		serverRootDir = serverRootDirFlag
	}

	mountpoint := flag.Arg(0)
	var mounter libfuse.Mounter
	if *mountType == "force" {
		mounter = libfuse.ForceMounter{Dir: mountpoint}
	} else {
		mounter = libfuse.DefaultMounter{Dir: mountpoint}
	}

	options := libfuse.StartOptions{
		LocalUser:     localUser,
		ServerRootDir: serverRootDir,
		CPUProfile:    *cpuprofile,
		MemProfile:    *memprofile,
		VersionFile:   *versionFile,
		Debug:         *debug,
		BServerAddr:   *bserverAddr,
		MDServerAddr:  *mdserverAddr,
	}

	return libfuse.Start(mounter, options)
}

func main() {
	err := start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kbfsfuse error: (%d) %s\n", err.Code, err.Message)

		os.Exit(err.Code)
	}
	os.Exit(0)
}
