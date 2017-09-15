// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package env

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

const (
	kbfsSocketFile = "kbfsd.sock"
)

// Context defines the environment for this package
type Context interface {
	GetRunMode() libkb.RunMode
	GetLogDir() string
	GetDataDir() string
	ConfigureSocketInfo() (err error)
	GetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error)
	NewRPCLogFactory() *libkb.RPCLogFactory
	GetKBFSSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error)
	BindToKBFSSocket() (net.Listener, error)
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

var libkbG *libkb.GlobalContext
var libkbGOnce sync.Once

func getLibkbG() *libkb.GlobalContext {
	libkbGOnce.Do(func() {
		g := libkb.NewGlobalContextInit()
		g.ConfigureConfig()
		g.ConfigureLogging()
		g.ConfigureCaches()
		g.ConfigureMerkleClient()
		libkbG = g
	})
	return libkbG
}

// NewContextFromGlobalContext constructs a context
func NewContextFromGlobalContext(g *libkb.GlobalContext) *KBFSContext {
	c := &KBFSContext{g: g}
	c.initKBFSSocket()
	return c
}

// NewContext constructs a context
func NewContext() *KBFSContext {
	return NewContextFromGlobalContext(getLibkbG())
}

// GetLogDir returns log dir
func (c *KBFSContext) GetLogDir() string {
	return c.g.Env.GetLogDir()
}

// GetDataDir returns log dir
func (c *KBFSContext) GetDataDir() string {
	return c.g.Env.GetDataDir()
}

// GetRunMode returns run mode
func (c *KBFSContext) GetRunMode() libkb.RunMode {
	return c.g.GetRunMode()
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
func (c *KBFSContext) NewRPCLogFactory() *libkb.RPCLogFactory {
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
		func() string { return c.getSandboxSocketFile() },
		// TODO: maybe add command-line option here
		func() string { return os.Getenv("KBFS_SOCKET_FILE") },
		func() string { return filepath.Join(e.GetRuntimeDir(), kbfsSocketFile) },
	)
}

func (c *KBFSContext) newTransportFromSocket(s net.Conn) rpc.Transporter {
	return rpc.NewTransport(s, c.NewRPCLogFactory(), libkb.WrapError)
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

// BindToKBFSSocket binds to the socket configured in `c.kbfsSocket`.
func (c *KBFSContext) BindToKBFSSocket() (net.Listener, error) {
	c.kbfsSocketMtx.RLock()
	defer c.kbfsSocketMtx.RUnlock()
	return c.kbfsSocket.BindToSocket()
}
