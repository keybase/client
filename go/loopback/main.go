package keybase

import (
	"encoding/base64"
	"fmt"
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
)

var con net.Conn
var startOnce sync.Once

type debuggingConfig struct {
	libkb.NullConfiguration
	homeDir   string
	runMode   string
	serverURI string
}

func (n debuggingConfig) GetDebug() (bool, bool) {
	// if you want helpful debug info in xcode
	return true, true
	// return false, false
}

func (n debuggingConfig) GetLocalRPCDebug() string {
	// if you want helpful debug info in xcode
	return "Acsvip"
	// return ""
}

func (n debuggingConfig) GetRunMode() (libkb.RunMode, error) {
	if n.runMode == "" {
		return libkb.DevelRunMode, nil
	}

	return libkb.StringToRunMode(n.runMode)
}

func (n debuggingConfig) GetHome() string {
	return n.homeDir
}

func (n debuggingConfig) GetServerURI() string {
	return n.serverURI
}

func start(cmdline libkb.CommandLine) {
	startOnce.Do(func() {
		libkb.G.Init()
		libkb.G.SetCommandLine(cmdline)
		libkb.G.ConfigureLogging()
		libkb.G.ConfigureUsage(libkb.Usage{
			Config:    true,
			API:       true,
			KbKeyring: true,
		})
		(service.NewService(false)).StartLoopbackServer(libkb.G)
		Reset()
	})
}

func Init(homeDir string, runMode string, serverURI string) {
	start(debuggingConfig{libkb.NullConfiguration{}, homeDir, runMode, serverURI})
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
	con, _, err = libkb.G.GetSocket()

	if err != nil {
		fmt.Println("loopback socker error:", err)
	}
}
