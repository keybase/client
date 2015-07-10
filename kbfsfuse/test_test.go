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

var (
	BServerRemote = flag.Bool("kbfs.bserverRemote", false, "which bserver to use, local or remote")
)

func init() {
	flag.Parse()
}

func TestMain(m *testing.M) {

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureSocketInfo()

	rand.Seed(time.Now().UnixNano())

	if *BServerRemote == true {
		fmt.Printf("Testing Using Remote Backend: %s\n", bserver.Config.BServerAddr)
		bserver.InitConfig("../bserver/testconfig.json")
		bserver.Config.TestNoSession = true
		bserver.StartBServer()
	}

	os.Exit(m.Run())
}
