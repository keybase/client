// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"fmt"
	"math/rand"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	bserver "github.com/keybase/kbfs/bserver"
)

var BServerRemoteAddr *string

const (
	// EnvBServerAddr is the environment variable name for a block server
	// address.
	EnvBServerAddr = "KEYBASE_BSERVER_BIND_ADDR"
)

func TestMain(m *testing.M) {
	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureSocketInfo()

	rand.Seed(time.Now().UnixNano())

	bserverAddr := os.Getenv(EnvBServerAddr)
	if len(bserverAddr) != 0 && strings.HasPrefix(bserverAddr, "127.0.0.1") {
		fmt.Println("Starting bserver at ", bserverAddr)
		bserver.StartBServer("dummy", bserverAddr, "")
	}

	os.Exit(m.Run())
}
