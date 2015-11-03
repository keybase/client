// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows
// socket_nix.go

package libkb

import (
	"net"
	"strings"
)

func (s SocketInfo) BindToSocket() (ret net.Listener, err error) {
	if err = MakeParentDirs(s.file); err != nil {
		return
	}
	s.G().Log.Info("Binding to unix:%s", s.file)
	return net.Listen("unix", s.file)
}

func (s SocketInfo) DialSocket() (ret net.Conn, err error) {
	s.G().Log.Debug("Dialing unix:%s", s.file)
	return net.Dial("unix", s.file)
}

func NewSocket(g *GlobalContext) (ret Socket, err error) {
	var s string
	s, err = g.Env.GetSocketFile()
	if err == nil {
		ret = SocketInfo{
			Contextified: NewContextified(g),
			file:         s,
		}
	}
	return
}

// net.errClosing isn't exported, so do this.. UGLY!
func IsSocketClosedError(e error) bool {
	return strings.HasSuffix(e.Error(), "use of closed network connection")
}
