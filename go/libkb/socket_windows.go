// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

// npipe_windows.go
package libkb

import (
	"errors"
	"net"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/npipe"
)

func NewSocket(g *GlobalContext) (ret Socket, err error) {
	var s string
	s, err = g.Env.GetSocketBindFile()
	if err != nil {
		return
	}
	if len(s) == 0 {
		err = errors.New("Empty SocketFile, can't make pipe")
		return
	}
	s = `\\.\pipe\kbservice` + strings.TrimPrefix(s, filepath.VolumeName(s))
	return SocketInfo{
		Contextified: NewContextified(g),
		bindFile:     s,
		dialFiles:    []string{s},
	}, nil
}

func (s SocketInfo) BindToSocket() (ret net.Listener, err error) {
	s.G().Log.Info("Binding to pipe:%s", s.bindFile)
	return npipe.Listen(s.bindFile)
}

func (s SocketInfo) DialSocket() (ret net.Conn, err error) {
	pipe, err := npipe.DialTimeout(s.dialFiles[0], time.Duration(1)*time.Second)
	if err != nil {
		// Be sure to return a nil interface, and not a nil npipe.PipeConn
		// See https://keybase.atlassian.net/browse/CORE-2675 for when this
		// bit us.
		return nil, err
	}
	// This can't happen right now, but in the future it might, so protect against ourselves
	// so we don't get vexing (*foo)(nil)/interface{}(nil) bugs.
	if pipe == nil {
		return nil, errors.New("bad npipe result; nil npipe.PipeConn but no error")
	}

	// Success case
	return pipe, err
}

func IsSocketClosedError(e error) bool {
	return e == npipe.ErrClosed
}
