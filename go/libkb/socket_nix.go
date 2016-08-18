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
	if err = MakeParentDirs(s.bindFile); err != nil {
		return
	}
	s.G().Log.Info("Binding to unix:%s", s.bindFile)
	return net.Listen("unix", s.bindFile)
}

func (s SocketInfo) DialSocket() (ret net.Conn, err error) {
	for _, file := range s.dialFiles {
		ret, err = s.dialSocket(file)
		if err == nil {
			return ret, nil
		}
	}
	return ret, err
}

func (s SocketInfo) dialSocket(file string) (ret net.Conn, err error) {
	s.G().Log.Debug("Dialing unix:%s", file)
	return net.Dial("unix", file)
}

func NewSocket(g *GlobalContext) (ret Socket, err error) {
	var dialFiles []string
	dialFiles, err = g.Env.GetSocketDialFiles()
	if err != nil {
		return
	}
	var bindFile string
	bindFile, err = g.Env.GetSocketBindFile()
	if err != nil {
		return
	}
	ret = SocketInfo{
		Contextified: NewContextified(g),
		dialFiles:    dialFiles,
		bindFile:     bindFile,
	}
	return
}

// net.errClosing isn't exported, so do this.. UGLY!
func IsSocketClosedError(e error) bool {
	return strings.HasSuffix(e.Error(), "use of closed network connection")
}
