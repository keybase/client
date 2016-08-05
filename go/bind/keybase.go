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
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
)

var kbCtx *libkb.GlobalContext
var conn net.Conn
var startOnce sync.Once
var logSendContext libkb.LogSendContext
var kbfsConfig libkbfs.Config

// InitOnce runs the Keybase services (only runs one time)
func InitOnce(homeDir string, logFile string, runModeStr string, accessGroupOverride bool) {
	startOnce.Do(func() {
		if err := Init(homeDir, logFile, runModeStr, accessGroupOverride); err != nil {
			kbCtx.Log.Errorf("Init error: %s", err)
		}
	})
}

// Init runs the Keybase services
func Init(homeDir string, logFile string, runModeStr string, accessGroupOverride bool) error {
	fmt.Println("Go: Initializing")
	fmt.Printf("Go: Using log: %s\n", logFile)
	kbCtx = libkb.G
	kbCtx.Init()
	usage := libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
	runMode, err := libkb.StringToRunMode(runModeStr)
	if err != nil {
		return err
	}
	config := libkb.AppConfig{
		HomeDir:                     homeDir,
		LogFile:                     logFile,
		RunMode:                     runMode,
		Debug:                       true,
		LocalRPCDebug:               "Acsvip",
		SecurityAccessGroupOverride: accessGroupOverride,
	}
	err = kbCtx.Configure(config, usage)
	if err != nil {
		return err
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

	// Initialize KBFS
	kbfsParams := libkbfs.DefaultInitParams(kbCtx)
	kbfsConfig, err = libkbfs.Init(kbCtx, kbfsParams, serviceCn{ctx: kbCtx}, func() {}, kbCtx.Log)
	if err != nil {
		return err
	}

	// Tell service that KBFS can handle FS protocols
	svc.RegisterOnConnect(func(srv *rpc.Server) error {
		return srv.Register(keybase1.FsProtocol(fsrpc.NewFS(kbfsConfig, kbCtx.Log)))
	})

	return Reset()
}

type serviceCn struct {
	ctx *libkb.GlobalContext
}

func (s serviceCn) NewKeybaseService(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseService, error) {
	// To use a local non-RPC service provider:
	// return newServiceProvider(s.ctx, config, log), nil

	// To use an RPC based service provider:
	return newServiceRPCProvider(s.ctx, config, log), nil
}

func (s serviceCn) NewCrypto(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.Crypto, error) {
	// To use a local non-RPC crypto provider:
	// return newCrypto(s.ctx, config, log), nil

	// To use an RPC based crypto provider:
	return newCryptoRPC(s.ctx, config, log), nil
}

// LogSend sends a log to Keybase
func LogSend(uiLogPath string) (string, error) {
	logSendContext.Logs.Desktop = uiLogPath
	return logSendContext.LogSend("", 10000)
}

// WriteB64 sends a base64 encoded msgpack rpc payload
func WriteB64(str string) error {
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return fmt.Errorf("Base64 decode error: %s; %s", err, str)
	}
	n, err := conn.Write(data)
	if err != nil {
		return fmt.Errorf("Write error: %s", err)
	}
	if n != len(data) {
		return errors.New("Did not write all the data")
	}
	return nil
}

const targetBufferSize = 50 * 1024

// bufferSize must be divisible by 3 to ensure that we don't split
// our b64 encode across a payload boundary if we go over our buffer
// size.
const bufferSize = targetBufferSize - (targetBufferSize % 3)

// ReadB64 is a blocking read for base64 encoded msgpack rpc data.
func ReadB64() (string, error) {
	data := make([]byte, bufferSize)

	n, err := conn.Read(data)
	if n > 0 && err == nil {
		str := base64.StdEncoding.EncodeToString(data[0:n])
		return str, nil
	}

	if err != nil {
		// Attempt to fix the connection
		Reset()
		return "", fmt.Errorf("Read error: %s", err)
	}

	return "", nil
}

// Reset resets the socket connection
func Reset() error {
	if conn != nil {
		conn.Close()
	}

	var err error
	conn, err = kbCtx.LoopbackListener.Dial()
	if err != nil {
		return fmt.Errorf("Socket error: %s", err)
	}
	return nil
}
