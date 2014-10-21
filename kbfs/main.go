// Keybase file system

package main

import (
	"flag"
	_ "fmt"
	"log"

	_ "github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	libkb "github.com/keybase/go-libkb"
	libkbfs "github.com/keybase/go-libkbfs-priv"
	_ "github.com/ugorji/go/codec"
)

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs MOUNTPOINT")
	}

	// set up fake FS
	root := &libkbfs.FSNode{Node: nodefs.NewDefaultNode()}

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
