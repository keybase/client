// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

// npipe_windows.go
package libkb

import (
	"errors"
	"net"
	"path/filepath"
	"strings"

	"github.com/natefinch/npipe"
)

func NewSocket(g *GlobalContext) (ret Socket, err error) {
	var s string
	s, err = g.Env.GetSocketFile()
	if err != nil {
		return
	}
	if len(s) == 0 {
		err = errors.New("Empty SocketFile, can't make pipe")
		return
	}
	s = strings.TrimPrefix(s, filepath.VolumeName(s))
	return SocketInfo{
		Contextified: NewContextified(g),
		file:         `\\.\pipe\kbservice` + s,
	}, nil
}

func (s SocketInfo) BindToSocket() (ret net.Listener, err error) {
	s.G().Log.Info("Binding to pipe:%s", s.file)
	return npipe.Listen(s.file)
}

func (s SocketInfo) DialSocket() (ret net.Conn, err error) {
	return npipe.DialTimeout(s.file, 10)
}

func IsSocketClosedError(e error) bool {
	return e == npipe.ErrClosed
}
