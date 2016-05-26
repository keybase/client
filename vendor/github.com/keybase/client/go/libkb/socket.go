// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"net"

	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// NewSocket() (Socket, err) is defined in the various platform-specific socket_*.go files.
type Socket interface {
	BindToSocket() (net.Listener, error)
	DialSocket() (net.Conn, error)
	GetFile() string
}

type SocketInfo struct {
	Contextified
	file string
}

func (s SocketInfo) GetFile() string {
	return s.file
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

func (g *GlobalContext) GetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error) {

	// Protect all global socket wrapper manipulation with a
	// lock to prevent race conditions.
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()

	isNew := false

	needWrapper := false
	if g.SocketWrapper == nil {
		needWrapper = true
	} else if g.SocketWrapper.xp != nil && !g.SocketWrapper.xp.IsConnected() {
		// need reconnect
		G.Log.Debug("rpc transport disconnected, reconnecting...")
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

	return sw.conn, sw.xp, isNew, sw.err
}
