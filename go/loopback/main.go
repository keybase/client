// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/base64"
	// "flag"
	"fmt"
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	// "github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/service"
	"github.com/keybase/kbfs/libkbfs"
)

var con net.Conn
var startOnce sync.Once

// ServerURI should match run mode environment.
func Init(homeDir string, runModeStr string, serverURI string, accessGroupOverride bool) {
	startOnce.Do(func() {
		g := libkb.G
		g.Init()
		usage := libkb.Usage{
			Config:    true,
			API:       true,
			KbKeyring: true,
		}
		runMode, err := libkb.StringToRunMode(runModeStr)
		if err != nil {
			fmt.Println("Error decoding run mode", err, runModeStr)
		}
		config := libkb.AppConfig{HomeDir: homeDir, RunMode: runMode, Debug: true, LocalRPCDebug: "Acsvip", ServerURI: serverURI, SecurityAccessGroupOverride: accessGroupOverride}
		err = libkb.G.Configure(config, usage)
		if err != nil {
			panic(err)
		}
		(service.NewService(g, false)).StartLoopbackServer()

		// kbfsParams := libkbfs.AddFlags(flag.NewFlagSet("flags", flag.ContinueOnError))
		// flag.Parse()
		// log := logger.NewWithCallDepth("", 1)
		// _, err = libkbfs.InitMobile(*kbfsParams, nil, nil)
		libkbfs.InitMobile(homeDir, "prod", g)
		if err != nil {
			fmt.Println("Error init kbfs", err)
			return
		}

		defer libkbfs.Shutdown()

		Reset()
	})
}

// Takes base64 encoded msgpack rpc payload
func WriteB64(str string) bool {
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		fmt.Println("Base64 decode error:", err, str)
	}
	n, err := con.Write(data)
	if err != nil {
		fmt.Println("Write error: ", err)
		return false
	}
	if n != len(data) {
		fmt.Println("Did not write all the data")
		return false
	}
	return true
}

// Blocking read, returns base64 encoded msgpack rpc payload
// bufferSize must be divisible by 3 to ensure that we don't split
// our b64 encode across a payload boundary if we go over our buffer
// size
const targetBufferSize = 50 * 1024
const bufferSize = targetBufferSize - (targetBufferSize % 3)

func ReadB64() string {
	data := make([]byte, bufferSize)

	n, err := con.Read(data)
	if n > 0 && err == nil {
		str := base64.StdEncoding.EncodeToString(data[0:n])
		return str
	}

	if err != nil {
		fmt.Println("read error:", err)
		// attempt to fix the connection
		Reset()
	}

	return ""
}

func Reset() {
	if con != nil {
		con.Close()
	}

	var err error
	libkb.G.SocketWrapper = nil
	con, _, _, err = libkb.G.GetSocket(false)

	if err != nil {
		fmt.Println("loopback socker error:", err)
	}
}
