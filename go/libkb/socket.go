// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package libkb

import (
	"fmt"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"net"
	"runtime"
)

type SocketInfo interface {
	PrepSocket() error
	ToStringPair() (string, string)
}

type SocketInfoUnix struct {
	file string
}

type SocketInfoTcp struct {
	port int
}

func (s SocketInfoUnix) PrepSocket() error {
	return MakeParentDirs(s.file)
}

func (s SocketInfoUnix) ToStringPair() (string, string) {
	return "unix", s.file
}

func (s SocketInfoTcp) PrepSocket() error {
	return nil
}

func (s SocketInfoTcp) ToStringPair() (string, string) {
	return "tcp", fmt.Sprintf("127.0.0.1:%d", s.port)
}

func BindToSocket(info SocketInfo) (ret net.Listener, err error) {
	if err = info.PrepSocket(); err != nil {
		return
	} else {
		l, a := info.ToStringPair()
		G.Log.Info("Binding to %s:%s", l, a)
		ret, err = net.Listen(l, a)
	}
	return
}

func DialSocket(info SocketInfo) (ret net.Conn, err error) {
	return net.Dial(info.ToStringPair())
}

func ConfigureSocketInfo() (ret SocketInfo, err error) {
	port := G.Env.GetDaemonPort()
	if runtime.GOOS == "windows" && port == 0 {
		port = DAEMON_PORT
	}
	if port != 0 {
		ret = SocketInfoTcp{port}
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

func (g *GlobalContext) BindToSocket() (net.Listener, error) {
	return BindToSocket(g.SocketInfo)
}

func (g *GlobalContext) GetSocket() (net.Conn, *rpc2.Transport, error) {
	if g.SocketWrapper == nil {
		sw := SocketWrapper{}
		if g.SocketInfo == nil {
			sw.err = fmt.Errorf("Cannot get socket in standalone mode")
		} else {
			sw.conn, sw.err = DialSocket(g.SocketInfo)
			if sw.err == nil {
				sw.xp = rpc2.NewTransport(sw.conn, NewRpcLogFactory(), WrapError)
			}
		}
		g.SocketWrapper = &sw
	}
	return g.SocketWrapper.conn, g.SocketWrapper.xp, g.SocketWrapper.err
}
