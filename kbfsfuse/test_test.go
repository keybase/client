package main

import (
	"flag"
	"fmt"
	"github.com/keybase/client/go/libkb"
	bserver "github.com/keybase/kbfs/bserver"
	"log"
	"math/rand"
	"testing"
	"time"
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

	m.Run()
}
