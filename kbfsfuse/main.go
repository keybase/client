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
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
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
	"fake local user (only valid when local=true)")
var client = flag.Bool("client", false, "use keybase daemon")
var debug = flag.Bool("debug", false, "Print FUSE debug messages")

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs [-client|-local] MOUNTPOINT")
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

	if *local {
		var localUid libkb.UID
		switch {
		case *localUser == "strib":
			localUid = libkb.UID{1}
		case *localUser == "max":
			localUid = libkb.UID{2}
		case *localUser == "chris":
			localUid = libkb.UID{3}
		case *localUser == "fred":
			localUid = libkb.UID{4}
		}
		stribKid := libkbfs.KID("strib-kid")
		maxKid := libkbfs.KID("max-kid")
		chrisKid := libkbfs.KID("chris-kid")
		fredKid := libkbfs.KID("fred-kid")
		k := libkbfs.NewKBPKILocal(localUid, []libkbfs.LocalUser{
			libkbfs.LocalUser{
				Name:            "strib",
				Uid:             libkb.UID{1},
				Asserts:         []string{"github:strib"},
				SubKeys:         []libkbfs.Key{libkbfs.NewKeyFake(stribKid)},
				DeviceSubkeyKid: stribKid,
			},
			libkbfs.LocalUser{
				Name:            "max",
				Uid:             libkb.UID{2},
				Asserts:         []string{"twitter:maxtaco"},
				SubKeys:         []libkbfs.Key{libkbfs.NewKeyFake(maxKid)},
				DeviceSubkeyKid: maxKid,
			},
			libkbfs.LocalUser{
				Name:            "chris",
				Uid:             libkb.UID{3},
				Asserts:         []string{"twitter:malgorithms"},
				SubKeys:         []libkbfs.Key{libkbfs.NewKeyFake(chrisKid)},
				DeviceSubkeyKid: chrisKid,
			},
			libkbfs.LocalUser{
				Name:            "fred",
				Uid:             libkb.UID{4},
				Asserts:         []string{"twitter:fakalin"},
				SubKeys:         []libkbfs.Key{libkbfs.NewKeyFake(fredKid)},
				DeviceSubkeyKid: fredKid,
			},
		})
		config.SetKBPKI(k)
	} else if *client {
		libkb.G.ConfigureSocketInfo()
		k, err := libkbfs.NewKBPKIClient(libkb.G)
		if err != nil {
			log.Fatalf("Could not get KBPKI: %v\n", err)
		}
		config.SetKBPKI(k)
	} else {
		log.Fatal("Usage:\n  kbfs [-client|-local] MOUNTPOINT")
	}

	root := NewFuseRoot(config)

	server, _, err := nodefs.MountRoot(flag.Arg(0), root, nil)
	if err != nil {
		log.Fatalf("Mount fail: %v\n", err)
	}

	if *debug {
		server.SetDebug(true)
	}
	server.Serve()
}
