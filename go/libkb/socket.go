// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"net"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// NewSocket() (Socket, err) is defined in the various platform-specific socket_*.go files.
type Socket interface {
	BindToSocket() (net.Listener, error)
	DialSocket() (net.Conn, error)
}

type SocketInfo struct {
	Contextified
	bindFile  string
	dialFiles []string
}

func (s SocketInfo) GetBindFile() string {
	return s.bindFile
}

func (s SocketInfo) GetDialFiles() []string {
	return s.dialFiles
}

type SocketWrapper struct {
	conn net.Conn
	xp   rpc.Transporter
	err  error
}

func (g *GlobalContext) MakeLoopbackServer() (l net.Listener, err error) {
	g.socketWrapperMu.Lock()
	g.LoopbackListener = NewLoopbackListener()
	l = g.LoopbackListener
	g.socketWrapperMu.Unlock()
	return
}

func (g *GlobalContext) BindToSocket() (net.Listener, error) {
	return g.SocketInfo.BindToSocket()
}

func NewTransportFromSocket(g *GlobalContext, s net.Conn) rpc.Transporter {
	return rpc.NewTransport(s, NewRPCLogFactory(g), WrapError)
}

// ResetSocket clears and returns a new socket
func (g *GlobalContext) ResetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error) {
	g.SocketWrapper = nil
	return g.GetSocket(clearError)
}

func (g *GlobalContext) GetSocket(clearError bool) (conn net.Conn, xp rpc.Transporter, isNew bool, err error) {

	g.Trace("GetSocket", func() error { return err })()

	// Protect all global socket wrapper manipulation with a
	// lock to prevent race conditions.
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()

	needWrapper := false
	if g.SocketWrapper == nil {
		needWrapper = true
		g.Log.Debug("| empty socket wrapper; need a new one")
	} else if g.SocketWrapper.xp != nil && !g.SocketWrapper.xp.IsConnected() {
		// need reconnect
		g.Log.Debug("| rpc transport isn't connected, reconnecting...")
		needWrapper = true
	}

	if needWrapper {
		sw := SocketWrapper{}
		if g.LoopbackListener != nil {
			sw.conn, sw.err = g.LoopbackListener.Dial()
		} else if g.SocketInfo == nil {
			sw.err = fmt.Errorf("Cannot get socket in standalone mode")
		} else {
			sw.conn, sw.err = g.SocketInfo.DialSocket()
			g.Log.Debug("| DialSocket -> %s", ErrToOk(sw.err))
			isNew = true
		}
		if sw.err == nil {
			sw.xp = NewTransportFromSocket(g, sw.conn)
		}
		g.SocketWrapper = &sw
	}

	sw := g.SocketWrapper
	if sw.err != nil && clearError {
		g.SocketWrapper = nil
	}
	err = sw.err

	return sw.conn, sw.xp, isNew, err
}
