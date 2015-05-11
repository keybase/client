// Keybase file system

package main

import (
	"flag"
	_ "fmt"
	"log"
	"os"
	"os/signal"
	"runtime/pprof"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUser = flag.String("localuser", "strib",
	"fake local user (only valid when local=true)")
var clientFlag = flag.Bool("client", false, "use keybase daemon")
var debug = flag.Bool("debug", false, "Print FUSE debug messages")
var newFUSE = flag.Bool("new-fuse", false, "use new FUSE implementation")

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
	mdserv, err := libkbfs.NewMDServerLocal(config, "kbfs_handles",
		"kbfs_dirs", "kbfs_md", "kbfs_unmerged")
	if err != nil {
		log.Fatalf("cannot open MD database: %v", err)
	}
	config.SetMDServer(mdserv)
	bserv, err := libkbfs.NewBlockServerLocal(config, "kbfs_block")
	if err != nil {
		log.Fatalf("cannot open block database: %v", err)
	}
	config.SetBlockServer(bserv)
	kops, err := libkbfs.NewKeyServerLocal(config.Codec(), "kbfs_keys")
	if err != nil {
		log.Fatalf("cannot open key database: %v", err)
	}
	config.SetKeyOps(kops)

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureMerkleClient()

	client.InitUI()
	libkb.G.UI.Configure()

	if *local {
		users := []string{"strib", "max", "chris", "fred"}
		userIndex := -1
		for i := range users {
			if *localUser == users[i] {
				userIndex = i
				break
			}
		}
		if userIndex < 0 {
			log.Fatalf("user %s not in list %v\n", *localUser, users)
		}

		localUsers := libkbfs.MakeLocalUsers(users)

		// TODO: Auto-generate these, too?
		localUsers[0].Asserts = []string{"github:strib"}
		localUsers[1].Asserts = []string{"twitter:maxtaco"}
		localUsers[2].Asserts = []string{"twitter:malgorithms"}
		localUsers[3].Asserts = []string{"twitter:fakalin"}

		var localUID keybase1.UID
		if userIndex >= 0 {
			localUID = localUsers[userIndex].UID
		}

		k := libkbfs.NewKBPKILocal(localUID, localUsers)
		config.SetKBPKI(k)
		signingKey := libkbfs.MakeLocalUserSigningKeyOrBust(*localUser)
		cryptPrivateKey := libkbfs.MakeLocalUserCryptPrivateKeyOrBust(*localUser)
		config.SetCrypto(libkbfs.NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey))
	} else if *clientFlag {
		libkb.G.ConfigureSocketInfo()
		k, err := libkbfs.NewKBPKIClient(libkb.G)
		if err != nil {
			log.Fatalf("Could not get KBPKI: %v\n", err)
		}
		config.SetKBPKI(k)
		c, err := libkbfs.NewCryptoClient(config.Codec(), libkb.G)
		if err != nil {
			log.Fatalf("Could not get Crypto: %v\n", err)
		}
		config.SetCrypto(c)
	} else {
		log.Fatal("Usage:\n  kbfs [-client|-local] MOUNTPOINT")
	}

	if *newFUSE {
		if err := runNewFUSE(config, *debug, flag.Arg(0)); err != nil {
			log.Fatalf("error serving filesystem: %v", err)
		}
	} else {
		if err := runHanwenFUSE(config, *debug, flag.Arg(0)); err != nil {
			log.Fatalf("error serving filesystem: %v", err)
		}
	}
}
