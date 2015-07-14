package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	bserver "github.com/keybase/kbfs/bserver"
)

var BServerRemoteAddr *string

func TestMain(m *testing.M) {

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureSocketInfo()

	rand.Seed(time.Now().UnixNano())

	useRemote := flag.Bool("kbfs.bserverRemote", false, "which bserver to use, local or remote")
	flag.Parse()

	if *useRemote {
		BServerRemoteAddr = &bserver.Config.BServerAddr
		fmt.Printf("Testing Using Remote Backend: %s\n", bserver.Config.BServerAddr)
		bserver.InitConfig("../bserver/testconfig.json")
		bserver.Config.TestNoSession = true
		bserver.StartBServer(nil)
	}

	os.Exit(m.Run())
}
