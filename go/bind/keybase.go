// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"sync"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvlsource"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	if logFile != "" {
		fmt.Printf("Go: Using log: %s\n", logFile)
	}

	kbCtx = libkb.G
	kbCtx.Init()
	kbCtx.SetServices(externals.GetServices())
	pvlsource.NewPvlSourceAndInstall(kbCtx)
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
		LocalRPCDebug:               "",
		SecurityAccessGroupOverride: accessGroupOverride,
	}
	err = kbCtx.Configure(config, usage)
	if err != nil {
		return err
	}

	svc := service.NewService(kbCtx, false)
	err = svc.StartLoopbackServer()
	if err != nil {
		return err
	}
	kbCtx.SetService()
	uir := service.NewUIRouter(kbCtx)
	kbCtx.SetUIRouter(uir)
	svc.RunBackgroundOperations(uir)

	serviceLog := config.GetLogFile()
	logs := libkb.Logs{
		Service: serviceLog,
	}

	logSendContext = libkb.LogSendContext{
		Contextified: libkb.NewContextified(kbCtx),
		Logs:         logs,
	}

	go func() {
		kbfsParams := libkbfs.DefaultInitParams(kbCtx)
		// Setting this flag will enable KBFS debug logging to alway be
		// true in a mobile setting. Kill this setting if too spammy.
		kbfsParams.Debug = true
		kbfsParams.Mode = libkbfs.InitMinimalString
		kbfsConfig, _ = libkbfs.Init(kbCtx, kbfsParams, serviceCn{}, func() {}, kbCtx.Log)
	}()

	return Reset()
}

type serviceCn struct {
	ctx *libkb.GlobalContext
}

func (s serviceCn) NewKeybaseService(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseService, error) {
	keybaseService := libkbfs.NewKeybaseDaemonRPC(config, ctx, log, true, nil)
	keybaseService.AddProtocols([]rpc.Protocol{
		keybase1.FsProtocol(fsrpc.NewFS(config, log)),
	})
	return keybaseService, nil
}

func (s serviceCn) NewCrypto(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.Crypto, error) {
	return libkbfs.NewCryptoClientRPC(config, ctx), nil
}

// LogSend sends a log to Keybase
func LogSend(feedback string, sendLogs bool, uiLogPath string) (string, error) {
	logSendContext.Logs.Desktop = uiLogPath
	return logSendContext.LogSend("", feedback, sendLogs, 5*1024*1024)
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

// buffer for the conn.Read
var buffer = make([]byte, bufferSize)

// ReadB64 is a blocking read for base64 encoded msgpack rpc data.
// It is called serially by the mobile run loops.
func ReadB64() (string, error) {
	n, err := conn.Read(buffer)
	if n > 0 && err == nil {
		str := base64.StdEncoding.EncodeToString(buffer[0:n])
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

// Version returns semantic version string
func Version() string {
	return libkb.VersionString()
}
