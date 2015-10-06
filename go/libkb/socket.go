package libkb

import (
	"fmt"
	"net"
	"runtime"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SocketInfo interface {
	PrepSocket() error
	ToStringPair() (string, string)
}

type SocketInfoUnix struct {
	file string
}

type SocketInfoTCP struct {
	port int
}

func (s SocketInfoUnix) PrepSocket() error {
	return MakeParentDirs(s.file)
}

func (s SocketInfoUnix) ToStringPair() (string, string) {
	return "unix", s.file
}

func (s SocketInfoTCP) PrepSocket() error {
	return nil
}

func (s SocketInfoTCP) ToStringPair() (string, string) {
	return "tcp", fmt.Sprintf("127.0.0.1:%d", s.port)
}

func BindToSocket(info SocketInfo) (ret net.Listener, err error) {
	if err = info.PrepSocket(); err != nil {
		return
	}
	l, a := info.ToStringPair()
	G.Log.Info("Binding to %s:%s", l, a)
	return net.Listen(l, a)
}

func DialSocket(info SocketInfo) (ret net.Conn, err error) {
	return net.Dial(info.ToStringPair())
}

func ConfigureSocketInfo() (ret SocketInfo, err error) {
	port := G.Env.GetDaemonPort()
	if runtime.GOOS == "windows" && port == 0 {
		port = DaemonPort
	}
	if port != 0 {
		ret = SocketInfoTCP{port}
	} else {
		var s string
		s, err = G.Env.GetSocketFile()
		if err == nil {
			ret = SocketInfoUnix{s}
		}
	}
	return
}

type SocketWrapper struct {
	conn net.Conn
	xp   *rpc2.Transport
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
	return BindToSocket(g.SocketInfo)
}

func (g *GlobalContext) ClearSocketError() {
	g.socketWrapperMu.Lock()
	g.SocketWrapper = nil
	g.socketWrapperMu.Unlock()
}

func (g *GlobalContext) GetSocket() (net.Conn, *rpc2.Transport, error) {

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
			sw.conn, sw.err = DialSocket(g.SocketInfo)
		}
		if sw.err == nil {
			sw.xp = rpc2.NewTransport(sw.conn, NewRPCLogFactory(), WrapError)
		}
		g.SocketWrapper = &sw
	}

	return g.SocketWrapper.conn, g.SocketWrapper.xp, g.SocketWrapper.err
}
