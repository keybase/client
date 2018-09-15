// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"errors"
	"net"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
	mspipe "github.com/keybase/go-winio"
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
	log := g.Log
	if log == nil {
		log = logger.NewNull()
	}

	// ownership tests fail when server is in same proces, as in tests
	return SocketInfo{
		log:       log,
		bindFile:  s,
		dialFiles: []string{s},
		testOwner: g.Env.Test == nil,
	}, nil
}

func NewSocketWithFiles(
	log logger.Logger, bindFile string, _ []string) Socket {
	s := `\\.\pipe\kbservice` +
		strings.TrimPrefix(bindFile, filepath.VolumeName(bindFile))
	return SocketInfo{
		log:       log,
		bindFile:  s,
		dialFiles: []string{s},
	}
}

func (s SocketInfo) BindToSocket() (ret net.Listener, err error) {
	s.log.Info("Binding to pipe:%s", s.bindFile)
	return mspipe.ListenPipe(s.bindFile, nil)
}

func (s SocketInfo) DialSocket() (ret net.Conn, err error) {
	timeout := time.Duration(1) * time.Second
	pipe, err := mspipe.DialPipe(s.dialFiles[0], &timeout)
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
		owner, err := IsPipeowner(s.log, s.dialFiles[0])
		if err != nil {
			return nil, err
		}
		if !owner.IsOwner {
			return nil, errors.New("failed to verify pipe ownership")
		}
	}
	// Success case
	return pipe, err
}

func IsSocketClosedError(e error) bool {
	return e == mspipe.ErrPipeListenerClosed
}
