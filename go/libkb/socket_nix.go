// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows
// socket_nix.go

package libkb

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Though I've never seen this come up in production, it definitely comes up
// in systests that multiple go-routines might race over the current
// working directory as they do the (chdir && dial) dance below. Make sure
// a lock is held whenever operating on sockets, so that two racing goroutines
// can't conflict here.
var bindLock sync.Mutex

func (s SocketInfo) BindToSocket() (net.Listener, error) {

	// Lock so that multiple goroutines can't race over current working dir.
	// See note above.
	bindLock.Lock()
	defer bindLock.Unlock()

	bindFile := s.bindFile
	if err := MakeParentDirs(bindFile); err != nil {
		return nil, err
	}

	// Path can't be longer than 108 characters.
	// In this case Chdir to the file directory first.
	// https://github.com/golang/go/issues/6895#issuecomment-98006662
	if len(bindFile) >= 108 {

		prevWd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("Error getting working directory: %s", err)
		}
		s.G().Log.Warning("Changing current working directory because path for binding is too long")
		if err := os.Chdir(filepath.Dir(bindFile)); err != nil {
			return nil, fmt.Errorf("Path can't be longer than 108 characters (failed to chdir): %s", err)
		}
		defer os.Chdir(prevWd)
		bindFile = filepath.Base(bindFile)
	}

	s.G().Log.Info("Binding to unix:%s", bindFile)
	return net.Listen("unix", bindFile)
}

func (s SocketInfo) DialSocket() (net.Conn, error) {
	errs := []error{}
	for _, file := range s.dialFiles {
		ret, err := s.dialSocket(file)
		if err == nil {
			return ret, nil
		}
		errs = append(errs, err)
	}
	return nil, CombineErrors(errs...)
}

func (s SocketInfo) dialSocket(dialFile string) (net.Conn, error) {

	// Lock so that multiple goroutines can't race over current working dir.
	// See note above.
	bindLock.Lock()
	defer bindLock.Unlock()

	if dialFile == "" {
		return nil, fmt.Errorf("Can't dial empty path")
	}
	// Path can't be longer than 108 characters.
	// In this case Chdir to the file directory first.
	// https://github.com/golang/go/issues/6895#issuecomment-98006662
	if len(dialFile) >= 108 {
		prevWd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("Error getting working directory: %s", err)
		}
		s.G().Log.Warning("Changing current working directory because path for dialing is too long")
		if err := os.Chdir(filepath.Dir(dialFile)); err != nil {
			return nil, fmt.Errorf("Path can't be longer than 108 characters (failed to chdir): %s", err)
		}
		defer os.Chdir(prevWd)
		dialFile = filepath.Base(dialFile)
	}

	s.G().Log.Debug("Dialing unix:%s", dialFile)
	return net.Dial("unix", dialFile)
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
