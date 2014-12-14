// Keybase file system

package main

import (
	"flag"
	_ "fmt"
	"log"
	"os"
	"os/signal"
	"runtime/pprof"

	"github.com/hanwen/go-fuse/fuse/nodefs"
	libkb "github.com/keybase/go-libkb"
	libkbfs "github.com/keybase/go-libkbfs-priv"
)

func GetUI() libkb.UI {
	ui := &libkbfs.UI{}
	ui.Configure()
	return ui
}

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUser = flag.String("localuser", "strib",
	"fake local user (only valid when local=true")
var debug = flag.Bool("debug", false, "Print FUSE debug messages")

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs MOUNTPOINT")
	}

	var cpuProfFile *os.File
	if *cpuprofile != "" {
		var err error
		cpuProfFile, err = os.Create(*cpuprofile)
		if err != nil {
			log.Fatal(err)
		}
		pprof.StartCPUProfile(cpuProfFile)
		defer cpuProfFile.Close()
	}

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, os.Interrupt, os.Kill)
	go func() {
		_ = <-sigchan
		if *cpuprofile != "" {
			pprof.StopCPUProfile()
		}

		if *memprofile != "" {
			f, err := os.Create(*memprofile)
			if err != nil {
				log.Fatal(err)
			}
			pprof.WriteHeapProfile(f)
			f.Close()
		}
		os.Exit(1)
	}()

	config := libkbfs.NewConfigLocal()

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureMerkleClient()
	libkb.G.SetUI(GetUI())

	if !*local {
		libkb.G.ConfigureAPI()
		if ok, err := libkb.G.Session.LoadAndCheck(); !ok || err != nil {
			log.Fatalf("Couldn't load session: %v\n", err)
		}
	} else {
		var localUid libkb.UID
		switch {
		case *localUser == "strib":
			localUid = libkb.UID{1}
		case *localUser == "max":
			localUid = libkb.UID{2}
		case *localUser == "chris":
			localUid = libkb.UID{3}
		}
		k := libkbfs.NewKBPKILocal(localUid, []*libkbfs.LocalUser{
			&libkbfs.LocalUser{"strib", libkb.UID{1}, []string{"github:strib"}},
			&libkbfs.LocalUser{"max", libkb.UID{2}, []string{"twitter:maxtaco"}},
			&libkbfs.LocalUser{
				"chris", libkb.UID{3}, []string{"twitter:malgorithms"}},
		})
		config.SetKBPKI(k)
	}

	root := libkbfs.NewFuseRoot(config)

	server, _, err := nodefs.MountRoot(flag.Arg(0), root, nil)
	if err != nil {
		log.Fatalf("Mount fail: %v\n", err)
	}

	if *debug {
		server.SetDebug(true)
	}
	server.Serve()
}
