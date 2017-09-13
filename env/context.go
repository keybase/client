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
	KBFSSocketFile = "kbfsd.sock"
)

// Context is an implementation for libkbfs.Context
type Context struct {
	g                 *libkb.GlobalContext
	KBFSSocket        libkb.Socket
	kbfsSocketMtx     sync.RWMutex
	kbfsSocketWrapper *libkb.SocketWrapper
}

var libkbOnce sync.Once

// NewContext constructs a context
func NewContext() *Context {
	// TODO: Remove direct use of libkb.G
	libkbOnce.Do(func() {
		libkb.G.Init()
		libkb.G.ConfigureConfig()
		libkb.G.ConfigureLogging()
		libkb.G.ConfigureCaches()
		libkb.G.ConfigureMerkleClient()
	})
	c := &Context{g: libkb.G}
	c.InitKBFSSocket()
	return c
}

// GetLogDir returns log dir
func (c Context) GetLogDir() string {
	return c.g.Env.GetLogDir()
}

// GetDataDir returns log dir
func (c Context) GetDataDir() string {
	return c.g.Env.GetDataDir()
}

// GetRunMode returns run mode
func (c Context) GetRunMode() libkb.RunMode {
	return c.g.GetRunMode()
}

// GetSocket returns a socket
func (c Context) GetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error) {
	return c.g.GetSocket(clearError)
}

// ConfigureSocketInfo configures a socket
func (c Context) ConfigureSocketInfo() error {
	return c.g.ConfigureSocketInfo()
}

// NewRPCLogFactory constructs an RPC logger
func (c Context) NewRPCLogFactory() *libkb.RPCLogFactory {
	return &libkb.RPCLogFactory{Contextified: libkb.NewContextified(c.g)}
}

func (c Context) getSandboxSocketFile() string {
	sandboxDir := c.g.Env.HomeFinder.SandboxCacheDir()
	if sandboxDir == "" {
		return ""
	}
	return filepath.Join(sandboxDir, KBFSSocketFile)
}

func (c Context) getKBFSSocketFile() string {
	e := c.g.Env
	return e.GetString(
		func() string { return c.getSandboxSocketFile() },
		// TODO: maybe add command-line option here
		func() string { return os.Getenv("KBFS_SOCKET_FILE") },
		func() string { return filepath.Join(e.GetRuntimeDir(), KBFSSocketFile) },
	)
}

func (c Context) newTransportFromSocket(s net.Conn) rpc.Transporter {
	return rpc.NewTransport(s, c.NewRPCLogFactory(), libkb.WrapError)
}

func (c *Context) GetKBFSSocket(clearError bool) (
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
		c.g.Log.Debug("| empty socket wrapper; need a new one")
	} else if c.kbfsSocketWrapper.Transporter != nil && !c.kbfsSocketWrapper.Transporter.IsConnected() {
		// need reconnect
		c.g.Log.Debug("| rpc transport isn't connected, reconnecting...")
		needWrapper = true
	}

	isNew := false
	if needWrapper {
		sw := libkb.SocketWrapper{}
		if c.KBFSSocket == nil {
			sw.Err = fmt.Errorf("Cannot get socket")
		} else {
			sw.Conn, sw.Err = c.KBFSSocket.DialSocket()
			c.g.Log.Debug("| DialSocket -> %s", libkb.ErrToOk(sw.Err))
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

	return sw.Conn, sw.Transporter, isNew, err
}

func (c *Context) BindToSocket() (net.Listener, error) {
	c.kbfsSocketMtx.RLock()
	defer c.kbfsSocketMtx.RUnlock()
	return c.KBFSSocket.BindToSocket()
}

func (c *Context) InitKBFSSocket() {
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()
	log := c.g.Log
	bindFile := c.getKBFSSocketFile()
	dialFiles := []string{bindFile}
	c.KBFSSocket = libkb.NewSocketWithFiles(log, bindFile, dialFiles)
}
