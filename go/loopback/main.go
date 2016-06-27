// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
)

var conn net.Conn
var startOnce sync.Once
var logSendContext libkb.LogSendContext

//var kbfsConfig libkbfs.Config

// Init ServerURI should match run mode environment.
func Init(homeDir string, logFile string, runModeStr string, serverURI string, accessGroupOverride bool) {
	startOnce.Do(func() {
		fmt.Println("Go: Initializing")
		fmt.Printf("Go: Using log: %s\n", logFile)
		kbCtx := libkb.G
		kbCtx.Init()
		usage := libkb.Usage{
			Config:    true,
			API:       true,
			KbKeyring: true,
		}
		runMode, err := libkb.StringToRunMode(runModeStr)
		if err != nil {
			fmt.Println("Error decoding run mode", err, runModeStr)
		}
		config := libkb.AppConfig{HomeDir: homeDir, LogFile: logFile, RunMode: runMode, Debug: true, LocalRPCDebug: "Acsvip", ServerURI: serverURI, SecurityAccessGroupOverride: accessGroupOverride}
		err = kbCtx.Configure(config, usage)
		if err != nil {
			panic(err)
		}

		svc := service.NewService(kbCtx, false)
		svc.StartLoopbackServer()
		kbCtx.SetService()
		kbCtx.SetUIRouter(service.NewUIRouter(kbCtx))

		serviceLog := config.GetLogFile()
		logs := libkb.Logs{
			Service: serviceLog,
		}

		logSendContext = libkb.LogSendContext{
			Contextified: libkb.NewContextified(kbCtx),
			Logs:         logs,
		}

		// Uncomment after we KBFS is ready
		// kbfsParams := libkbfs.DefaultInitParams(kbCtx)
		// onInterruptFn := func() {}
		// kbfsConfig, err = libkbfs.Init(kbCtx, kbfsParams, newKeybaseDaemon, onInterruptFn, kbCtx.Log)
		// if err != nil {
		// 	panic(err)
		// }

		Reset()
		fmt.Println("Go: Done")
	})
}

// Uncomment after we KBFS is ready
// func newKeybaseDaemon(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseDaemon, error) {
// 	keybaseDaemon := libkbfs.NewKeybaseDaemonRPC(config, ctx, log, true)
// 	keybaseDaemon.AddProtocols([]rpc.Protocol{
// 		keybase1.FsProtocol(fsRpc.NewFS(config, log)),
// 	})
// 	return keybaseDaemon, nil
// }

// LogSend sends a log to kb
func LogSend(uiLogPath string) (string, error) {
	logSendContext.Logs.Desktop = uiLogPath

	return logSendContext.LogSend("", 10000)
}

func reportError(err error) {
	libkb.G.Log.Errorf("Error in loopback: %s", err)
}

// WriteB64 Takes base64 encoded msgpack rpc payload
func WriteB64(str string) bool {
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		reportError(fmt.Errorf("Base64 decode error: %s; %s", err, str))
	}
	n, err := conn.Write(data)
	if err != nil {
		reportError(fmt.Errorf("Write error: %s", err))
		return false
	}
	if n != len(data) {
		reportError(errors.New("Did not write all the data"))
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

// ReadB64 Read b64 msgpack off the wire
func ReadB64() string {
	data := make([]byte, bufferSize)

	n, err := conn.Read(data)
	if n > 0 && err == nil {
		str := base64.StdEncoding.EncodeToString(data[0:n])
		return str
	}

	if err != nil {
		reportError(fmt.Errorf("Read error: %s", err))
		// attempt to fix the connection
		Reset()
	}

	return ""
}

// Reset resets the socket connection
func Reset() {
	if conn != nil {
		conn.Close()
	}

	var err error
	libkb.G.SocketWrapper = nil
	conn, _, _, err = libkb.G.GetSocket(false)

	if err != nil {
		reportError(fmt.Errorf("Socket error: %s", err))
	}
}
