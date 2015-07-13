package main

import (
	"errors"
	"flag"
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUserFlag = flag.String("localuser", "strib",
	"fake local user (only valid when local=true)")
var clientFlag = flag.Bool("client", false, "use keybase daemon")

const usageStr = `Usage:
  kbfs [-client | -local [-localuser=<user>]] <command> [<args>]

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

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		printError("kbfs", errors.New("either -client or -local must be used"))
		exitStatus = 1
		return
	}

	config, err := libkbfs.Init(localUser, *cpuprofile, *memprofile)
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
