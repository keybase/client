// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"net"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// NewSocket() (Socket, err) is defined in the various platform-specific socket_*.go files.
type Socket interface {
	BindToSocket() (net.Listener, error)
	DialSocket() (net.Conn, error)
}

type SocketInfo struct {
	log       logger.Logger
	bindFile  string
	dialFiles []string
	testOwner bool //nolint
}

func (s SocketInfo) GetBindFile() string {
	return s.bindFile
}

func (s SocketInfo) GetDialFiles() []string {
	return s.dialFiles
}

type SocketWrapper struct {
	Conn        net.Conn
	Transporter rpc.Transporter
	Err         error
}

func (g *GlobalContext) MakeLoopbackServer() (l net.Listener, err error) {
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()
	g.LoopbackListener = NewLoopbackListener(g)
	l = g.LoopbackListener
	return l, err
}

func (g *GlobalContext) BindToSocket() (net.Listener, error) {
	return g.SocketInfo.BindToSocket()
}

func NewTransportFromSocket(g *GlobalContext, s net.Conn, src keybase1.NetworkSource) rpc.Transporter {
	return rpc.NewTransport(s, NewRPCLogFactory(g), NetworkInstrumenterStorageFromSrc(g, src), MakeWrapError(g), rpc.DefaultMaxFrameLength)
}

// ResetSocket clears and returns a new socket
func (g *GlobalContext) ResetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error) {
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()

	g.SocketWrapper = nil
	return g.getSocketLocked(clearError)
}

func (g *GlobalContext) GetSocket(clearError bool) (conn net.Conn, xp rpc.Transporter, isNew bool, err error) {
	g.Trace("GetSocket", &err)()
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()
	return g.getSocketLocked(clearError)
}

func (g *GlobalContext) getSocketLocked(clearError bool) (conn net.Conn, xp rpc.Transporter, isNew bool, err error) {
	needWrapper := false
	if g.SocketWrapper == nil {
		needWrapper = true
		g.Log.Debug("| empty socket wrapper; need a new one")
	} else if g.SocketWrapper.Transporter != nil && !g.SocketWrapper.Transporter.IsConnected() {
		// need reconnect
		g.Log.Debug("| rpc transport isn't connected, reconnecting...")
		needWrapper = true
	}

	if needWrapper {
		sw := SocketWrapper{}
		if g.LoopbackListener != nil {
			sw.Conn, sw.Err = g.LoopbackListener.Dial()
		} else if g.SocketInfo == nil {
			sw.Err = fmt.Errorf("Cannot get socket in standalone mode")
		} else {
			sw.Conn, sw.Err = g.SocketInfo.DialSocket()
			g.Log.Debug("| DialSocket -> %s", ErrToOk(sw.Err))
			isNew = true
		}
		if sw.Err == nil {
			sw.Transporter = NewTransportFromSocket(g, sw.Conn, keybase1.NetworkSource_LOCAL)
		}
		g.SocketWrapper = &sw
	}

	sw := g.SocketWrapper
	if sw.Err != nil && clearError {
		g.SocketWrapper = nil
	}
	err = sw.Err

	return sw.Conn, sw.Transporter, isNew, err
}
