package main

import (
	"flag"
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var localUserFlag = flag.String("localuser", "", "fake local user")
var serverRootDirFlag = flag.String("server-root", "", "directory to put local server files (default is cwd)")
var serverInMemoryFlag = flag.Bool("server-in-memory", false, "use in-memory server (and ignore -server-root)")
var debug = flag.Bool("debug", false, "Print debug messages")
var bserverAddr = flag.String("bserver", "", "host:port of the block server (ex: bserver.dev.keybase.io:443)")
var mdserverAddr = flag.String("mdserver", "", "host:port of the metadata server (ex: mdserver.dev.keybase.io:443)")

const usageStr = `Usage:
  kbfs [-localuser=<user>] [-debug]
    [-server-in-memory|-server-root=path/to/dir]
    [-bserver=host:port] [-mdserver=host:port] <command> [<args>]

The possible commands are:
  stat		Display file status
  ls		List directory contents
  mkdir		Make directories
  read		Dump file to stdout
  write		Write stdin to file

`

// Define this so deferred functions get executed before exit.
func realMain() (exitStatus int) {
	flag.Parse()
	if len(flag.Args()) < 1 {
		fmt.Print(usageStr)
		exitStatus = 1
		return
	}

	localUser := libkb.NewNormalizedUsername(*localUserFlag)

	var serverRootDir *string
	if !*serverInMemoryFlag {
		serverRootDir = serverRootDirFlag
	}

	config, err := libkbfs.Init(localUser, serverRootDir, *cpuprofile,
		*memprofile, nil, *debug, *bserverAddr, *mdserverAddr)
	if err != nil {
		printError("kbfs", err)
		exitStatus = 1
		return
	}

	defer libkbfs.Shutdown(*memprofile)

	cmd := flag.Arg(0)
	args := flag.Args()[1:]

	ctx := context.Background()

	switch cmd {
	case "stat":
		return stat(ctx, config, args)
	case "ls":
		return ls(ctx, config, args)
	case "mkdir":
		return mkdir(ctx, config, args)
	case "read":
		return read(ctx, config, args)
	case "write":
		return write(ctx, config, args)
	default:
		printError("kbfs", fmt.Errorf("unknown command '%s'", cmd))
		exitStatus = 1
		return
	}
}

func main() {
	os.Exit(realMain())
}
