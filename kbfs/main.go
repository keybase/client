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

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs MOUNTPOINT")
	}

	config := libkbfs.NewConfigLocal()
	root := libkbfs.NewFuseRoot(config)

	server, _, err := nodefs.MountRoot(flag.Arg(0), root, nil)
	if err != nil {
		log.Fatalf("Mount fail: %v\n", err)
	}

	server.SetDebug(true)
	libkb.G.Init()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureAPI()
	server.Serve()
}
