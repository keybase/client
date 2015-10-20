package libkb

import (
	"fmt"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"net"
)

// NewSocket() (Socket, err) is defined in the various platform-specific socket_*.go files.
type Socket interface {
	BindToSocket() (net.Listener, error)
	DialSocket() (net.Conn, error)
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

func (g *GlobalContext) GetSocket(clearError bool) (net.Conn, rpc.Transporter, error) {

	// Protect all global socket wrapper manipulation with a
	// lock to prevent race conditions.
	g.socketWrapperMu.Lock()
	defer g.socketWrapperMu.Unlock()

	needWrapper := false
	if g.SocketWrapper == nil {
		needWrapper = true
	} else if g.SocketWrapper.xp != nil && !g.SocketWrapper.xp.IsConnected() {
		// need reconnect
		G.Log.Info("rpc transport disconnected, reconnecting...")
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
		}
		if sw.err == nil {
			sw.xp = rpc.NewTransport(sw.conn, NewRPCLogFactory(), WrapError)
		}
		g.SocketWrapper = &sw
	}

	sw := g.SocketWrapper
	if sw.err != nil && clearError {
		g.SocketWrapper = nil
	}

	return sw.conn, sw.xp, sw.err
}
