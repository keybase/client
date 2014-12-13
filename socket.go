// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package libkb

import (
	"fmt"
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
