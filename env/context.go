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
	KBFSSocketInfo    SocketInfo
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
	c.InitSocketInfo()
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
	return rpc.NewTransport(s, NewRPCLogFactory(), libkb.WrapError)
}

func (c *Context) GetKBFSSocket(clearError bool) (
	net.Conn, rpc.Transporter, bool, error) {

	c.g.Trace("GetSocket", func() error { return err })()

	// Protect all global socket wrapper manipulation with a
	// lock to prevent race conditions.
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()

	needWrapper := false
	if c.kbfsSocketWrapper == nil {
		needWrapper = true
		c.Log.Debug("| empty socket wrapper; need a new one")
	} else if c.kbfsSocketWrapper.xp != nil && !c.kbfsSocketWrapper.xp.IsConnected() {
		// need reconnect
		c.Log.Debug("| rpc transport isn't connected, reconnecting...")
		needWrapper = true
	}

	isNew := false
	if needWrapper {
		sw := SocketWrapper{}
		if c.KBFSSocketInfo == nil {
			sw.err = fmt.Errorf("Cannot get socket")
		} else {
			sw.conn, sw.err = c.KBFSSocketInfo.DialSocket()
			c.g.Log.Debug("| DialSocket -> %s", ErrToOk(sw.err))
			isNew = true
		}
		if sw.err == nil {
			sw.xp = NewTransportFromSocket(g, sw.conn)
		}
		c.kbfsSocketWrapper = &sw
	}

	// Return the current error no matter what
	err := c.kbfsSocketWrapper.err
	if err != nil && clearError {
		c.kbfsSocketWrapper = nil
	}

	return sw.conn, sw.xp, isNew, err
}

func (c *Context) BindToSocket() (net.Listener, error) {
	c.kbfsSocketMtx.RLock()
	defer c.kbfsSocketMtx.RUnlock()
	return c.SocketInfo.BindToSocket()
}

func (c *Context) InitSocketInfo() {
	c.kbfsSocketMtx.Lock()
	defer c.kbfsSocketMtx.Unlock()
	log := c.g.Log
	bindFile := c.getKBFSSocketFile()
	dialFiles := []string{bindFile}
	c.SocketInfo = NewSocketWithFiles(log, bindFile, dialFiles)
}
