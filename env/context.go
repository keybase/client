// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package env

import (
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc"
)

// Context is an implementation for libkbfs.Context
type Context struct {
	g *libkb.GlobalContext
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
	return &Context{g: libkb.G}
}

// GetLogDir returns log dir
func (c Context) GetLogDir() string {
	return c.g.Env.GetLogDir()
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
