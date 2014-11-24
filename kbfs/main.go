// Keybase file system

package main

import (
	"flag"
	_ "fmt"
	"log"

	"github.com/hanwen/go-fuse/fuse/nodefs"
	libkb "github.com/keybase/go-libkb"
	libkbfs "github.com/keybase/go-libkbfs-priv"
)

func GetUI() UI {
	ui := UI{}
	ui.Configure()
	return ui
}

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs MOUNTPOINT")
	}

	// TODO: make this an option:
	localUsers := true

	config := libkbfs.NewConfigLocal()

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureMerkleClient()
	libkb.G.SetUI(GetUI())

	if !localUsers {
		libkb.G.ConfigureAPI()
		if ok, err := libkb.G.Session.LoadAndCheck(); !ok || err != nil {
			log.Fatalf("Couldn't load session: %v\n", err)
		}
	} else {
		k := libkbfs.NewKBPKILocal(libkb.UID{3}, []*libkbfs.LocalUser{
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

	server.SetDebug(true)
	server.Serve()
}
