package libfuse

import (
	"flag"
	"fmt"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	bserver "github.com/keybase/kbfs/bserver"
)

var BServerRemoteAddr *string

func TestMain(m *testing.M) {
	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureSocketInfo()

	rand.Seed(time.Now().UnixNano())

	bserverPort := flag.String("kbfs.bserverPort", "", "specify the port of bserver on localhost, otherwise, only local server is used")
	flag.Parse()

	if *bserverPort != "" {
		// TODO: do we still need the commented-out lines below?
		//bserver.InitConfig("../bserver/testconfig.json")
		srvAddr := "127.0.0.1:" + *bserverPort
		fmt.Printf("Testing Using Remote Backend: %s\n", srvAddr)
		BServerRemoteAddr = &srvAddr
		//bserver.Config.TestNoSession = true
		bserver.StartBServer(srvAddr)
	}

	os.Exit(m.Run())
}
