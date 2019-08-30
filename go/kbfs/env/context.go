// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package env

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

const (
	kbfsSocketFile = "kbfsd.sock"
)

// AppStateUpdater is an interface for things that need to listen to
// app state changes.
type AppStateUpdater interface {
	// NextAppStateUpdate returns a channel that app state changes
	// are sent to.
	NextAppStateUpdate(lastState *keybase1.MobileAppState) <-chan keybase1.MobileAppState
}

// EmptyAppStateUpdater is an implementation of AppStateUpdater that
// never returns an update, for testing.
type EmptyAppStateUpdater struct{}

// NextAppStateUpdate implements AppStateUpdater.
func (easu EmptyAppStateUpdater) NextAppStateUpdate(lastState *keybase1.MobileAppState) <-chan keybase1.MobileAppState {
	// Receiving on a nil channel blocks forever.
	return nil
}

// Context defines the environment for this package
type Context interface {
	AppStateUpdater
	GetRunMode() kbconst.RunMode
	GetLogDir() string
	GetDataDir() string
	GetEnv() *libkb.Env
	GetMountDir() (string, error)
	ConfigureSocketInfo() (err error)
	CheckService() error
	GetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error)
	NewRPCLogFactory() rpc.LogFactory
	GetKBFSSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error)
	BindToKBFSSocket() (net.Listener, error)
	GetVDebugSetting() string
}

// KBFSContext is an implementation for libkbfs.Context
type KBFSContext struct {
	g *libkb.GlobalContext
	// protects the socket primitives below
	kbfsSocketMtx     sync.RWMutex
	kbfsSocket        libkb.Socket
	kbfsSocketWrapper *libkb.SocketWrapper
}

var _ Context = (*KBFSContext)(nil)

func (c *KBFSContext) initKBFSSocket() {
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()
	log := c.g.Log
	bindFile := c.getKBFSSocketFile()
	dialFiles := []string{bindFile}
	c.kbfsSocket = libkb.NewSocketWithFiles(log, bindFile, dialFiles)
}

// NewContextFromGlobalContext constructs a context
func NewContextFromGlobalContext(g *libkb.GlobalContext) *KBFSContext {
	c := &KBFSContext{g: g}
	c.initKBFSSocket()
	return c
}

// NewContext constructs a context. This should only be called once in
// main functions.
func NewContext() *KBFSContext {
	g := libkb.NewGlobalContextInit()
	err := g.ConfigureConfig()
	if err != nil {
		panic(err)
	}
	err = g.ConfigureLogging()
	if err != nil {
		panic(err)
	}
	err = g.ConfigureCaches()
	if err != nil {
		panic(err)
	}
	err = g.ConfigureMerkleClient()
	if err != nil {
		panic(err)
	}
	return NewContextFromGlobalContext(g)
}

// GetLogDir returns log dir
func (c *KBFSContext) GetLogDir() string {
	return c.g.Env.GetLogDir()
}

// GetDataDir returns log dir
func (c *KBFSContext) GetDataDir() string {
	return c.g.Env.GetDataDir()
}

// GetMountDir returns mount dir
func (c *KBFSContext) GetMountDir() (string, error) {
	return c.g.Env.GetMountDir()
}

// GetEnv returns the global Env
func (c *KBFSContext) GetEnv() *libkb.Env {
	return c.g.Env
}

// GetRunMode returns run mode
func (c *KBFSContext) GetRunMode() kbconst.RunMode {
	return c.g.GetRunMode()
}

// NextAppStateUpdate implements AppStateUpdater.
func (c *KBFSContext) NextAppStateUpdate(lastState *keybase1.MobileAppState) <-chan keybase1.MobileAppState {
	return c.g.MobileAppState.NextUpdate(lastState)
}

// CheckService checks if the service is running and returns nil if
// so, and an error otherwise.
func (c *KBFSContext) CheckService() error {
	// Trying to dial the service seems like the best
	// platform-agnostic way of seeing if the service is up.
	// Stat-ing the socket file, for example, doesn't work for
	// Windows named pipes.
	s, err := libkb.NewSocket(c.g)
	if err != nil {
		return err
	}
	conn, err := s.DialSocket()
	if err != nil {
		if runtime.GOOS == "darwin" || runtime.GOOS == "windows" {
			return errors.New(
				"keybase isn't running; open the Keybase app")
		}
		return errors.New(
			"keybase isn't running; try `run_keybase`")
	}
	err = conn.Close()
	if err != nil {
		return err
	}
	return nil
}

// GetSocket returns a socket
func (c *KBFSContext) GetSocket(clearError bool) (
	net.Conn, rpc.Transporter, bool, error) {
	return c.g.GetSocket(clearError)
}

// ConfigureSocketInfo configures a socket
func (c *KBFSContext) ConfigureSocketInfo() error {
	return c.g.ConfigureSocketInfo()
}

// NewRPCLogFactory constructs an RPC logger
func (c *KBFSContext) NewRPCLogFactory() rpc.LogFactory {
	return &libkb.RPCLogFactory{Contextified: libkb.NewContextified(c.g)}
}

func (c *KBFSContext) getSandboxSocketFile() string {
	sandboxDir := c.g.Env.HomeFinder.SandboxCacheDir()
	if sandboxDir == "" {
		return ""
	}
	return filepath.Join(sandboxDir, kbfsSocketFile)
}

func (c *KBFSContext) getKBFSSocketFile() string {
	e := c.g.Env
	return e.GetString(
		c.getSandboxSocketFile,
		// TODO: maybe add command-line option here
		func() string { return os.Getenv("KBFS_SOCKET_FILE") },
		func() string { return filepath.Join(e.GetRuntimeDir(), kbfsSocketFile) },
	)
}

func (c *KBFSContext) newTransportFromSocket(s net.Conn) rpc.Transporter {
	return rpc.NewTransport(s, c.NewRPCLogFactory(), libkb.WrapError, rpc.DefaultMaxFrameLength)
}

// GetKBFSSocket dials the socket configured in `c.kbfsSocket`.
// Adapted from github.com/keybase/client/go/libkb.GlobalContext.GetSocket.
func (c *KBFSContext) GetKBFSSocket(clearError bool) (
	net.Conn, rpc.Transporter, bool, error) {
	var err error
	c.g.Trace("GetSocket", func() error { return err })()

	// Protect all global socket wrapper manipulation with a
	// lock to prevent race conditions.
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()

	needWrapper := false
	if c.kbfsSocketWrapper == nil {
		needWrapper = true
		c.g.Log.Debug("empty socket wrapper; need a new one")
	} else if c.kbfsSocketWrapper.Transporter != nil && !c.kbfsSocketWrapper.Transporter.IsConnected() {
		// need reconnect
		c.g.Log.Debug("rpc transport isn't connected, reconnecting...")
		needWrapper = true
	}

	isNew := false
	if needWrapper {
		sw := libkb.SocketWrapper{}
		if c.kbfsSocket == nil {
			sw.Err = fmt.Errorf("Cannot get socket")
		} else {
			sw.Conn, sw.Err = c.kbfsSocket.DialSocket()
			c.g.Log.Debug("DialSocket -> %s", libkb.ErrToOk(sw.Err))
			isNew = true
		}
		if sw.Err == nil {
			sw.Transporter = c.newTransportFromSocket(sw.Conn)
		}
		c.kbfsSocketWrapper = &sw
	}

	// Return the current error no matter what
	sw := c.kbfsSocketWrapper
	if sw.Err != nil && clearError {
		c.kbfsSocketWrapper = nil
	}

	return sw.Conn, sw.Transporter, isNew, sw.Err
}

// cleanupSocketFile cleans up the socket file for binding.
func (c *KBFSContext) cleanupSocketFile() error {
	switch sock := c.kbfsSocket.(type) {
	case libkb.SocketInfo:
		sf := sock.GetBindFile()
		if exists, err := libkb.FileExists(sf); err != nil {
			return err
		} else if exists {
			c.g.Log.Debug("removing stale socket file: %s", sf)
			if err = os.Remove(sf); err != nil {
				c.g.Log.Warning("error removing stale socket file: %s", err)
				return err
			}
		}
	case nil:
		return errors.New("socket not initialized")
	default:
		return errors.New("invalid socket type")
	}
	return nil
}

// BindToKBFSSocket binds to the socket configured in `c.kbfsSocket`.
func (c *KBFSContext) BindToKBFSSocket() (net.Listener, error) {
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()
	err := c.cleanupSocketFile()
	if err != nil {
		return nil, err
	}
	return c.kbfsSocket.BindToSocket()
}

// GetVDebugSetting returns the verbose debug logger.
func (c *KBFSContext) GetVDebugSetting() string {
	return c.g.Env.GetVDebugSetting()
}
