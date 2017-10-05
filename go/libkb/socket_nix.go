// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

	"github.com/keybase/client/go/logger"
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
	if err := MakeParentDirs(s.log, bindFile); err != nil {
		return nil, err
	}

	// Path can't be longer than N characters.
	// In this case Chdir to the file directory first and use a local path.
	// On many linuxes, N=108, on some N=106, and on macOS N=104.
	// N=104 is the lowest I know of.
	// It's the length of the path buffer in sockaddr_un.
	// And there may be a null-terminator in there, not sure, so make it 103 for good luck.
	// https://github.com/golang/go/issues/6895#issuecomment-98006662
	// https://gist.github.com/mlsteele/16dc5b6eb3d112b914183928c9af71b8#file-un-h-L79
	// We could always Chdir, but then this function would be non-threadsafe more of the time.
	// Pick your poison.
	if len(bindFile) >= 103 {
		prevWd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("Error getting working directory: %s", err)
		}
		s.log.Warning("Changing current working directory because path for binding is too long")
		if err := os.Chdir(filepath.Dir(bindFile)); err != nil {
			return nil, fmt.Errorf("Path can't be longer than 108 characters (failed to chdir): %s", err)
		}
		defer os.Chdir(prevWd)
		bindFile = filepath.Base(bindFile)
	}

	s.log.Info("Binding to unix:%s", bindFile)
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
		s.log.Warning("Changing current working directory because path for dialing is too long")
		if err := os.Chdir(filepath.Dir(dialFile)); err != nil {
			return nil, fmt.Errorf("Path can't be longer than 108 characters (failed to chdir): %s", err)
		}
		defer os.Chdir(prevWd)
		dialFile = filepath.Base(dialFile)
	}

	s.log.Debug("Dialing unix:%s", dialFile)
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
	log := g.Log
	if log == nil {
		log = logger.NewNull()
	}
	ret = SocketInfo{
		log:       log,
		dialFiles: dialFiles,
		bindFile:  bindFile,
	}
	return
}

func NewSocketWithFiles(
	log logger.Logger, bindFile string, dialFiles []string) Socket {
	return SocketInfo{
		log:       log,
		bindFile:  bindFile,
		dialFiles: dialFiles,
	}
}

// net.errClosing isn't exported, so do this.. UGLY!
func IsSocketClosedError(e error) bool {
	return strings.HasSuffix(e.Error(), "use of closed network connection")
}
