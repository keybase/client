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
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/npipe"
)

type SocketWindows struct {
	log       logger.Logger
	bindFile  string
	dialFiles []string
	testOwner bool
}

var _ Socketer = SocketWindows{}

func NewSocket(g *GlobalContext) (ret Socketer, err error) {
	var s string
	s, err = g.Env.GetSocketBindFile()
	if err != nil {
		return nil, err
	}
	if len(s) == 0 {
		err = errors.New("Empty SocketFile, can't make pipe")
		return nil, err
	}
	s = `\\.\pipe\kbservice` + strings.TrimPrefix(s, filepath.VolumeName(s))
	log := g.Log
	if log == nil {
		log = logger.NewNull()
	}

	// ownership tests fail when server is in same proces, as in tests
	return SocketWindows{
		log:       log,
		bindFile:  s,
		testOwner: g.Env.Test == nil,
	}, nil
}

func NewSocketWithFiles(
	log logger.Logger, bindFile string, _ []string) Socket {
	s := `\\.\pipe\kbservice` +
		strings.TrimPrefix(bindFile, filepath.VolumeName(bindFile))
	return SocketWindows{
		log:      log,
		bindFile: s,
	}
}

func (s SocketWindows) BindToSocket() (ret net.Listener, err error) {
	s.log.Info("Binding to pipe:%s", s.bindFile)
	return npipe.Listen(s.bindFile)
}

func (s SocketWindows) DialSocket() (ret net.Conn, err error) {
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

	// Test ownership
	if s.testOwner {
		owner, err := IsPipeowner(s.dialFiles[0])
		if err != nil {
			return nil, err
		}
		if !owner {
			return nil, errors.New("failed to verify pipe ownership")
		}
	}
	// Success case
	return pipe, err
}

func IsSocketClosedError(e error) bool {
	return e == npipe.ErrClosed
}
