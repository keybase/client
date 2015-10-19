// +build !windows
// socket_nix.go

package libkb

import (
	"net"
)

type SocketUnix struct {
	file string
}

func (s SocketUnix) BindToSocket() (ret net.Listener, err error) {
	if err = MakeParentDirs(s.file); err != nil {
		return
	}
	G.Log.Info("Binding to unix:%s", s.file)
	return net.Listen("unix", s.file)
}

func (s SocketUnix) DialSocket() (ret net.Conn, err error) {
	return net.Dial("unix", s.file)
}

func NewSocket() (ret Socket, err error) {
	var s string
	s, err = G.Env.GetSocketFile()
	if err == nil {
		ret = SocketUnix{s}
	}
	return
}
