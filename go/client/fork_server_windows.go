// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"fmt"
	"os"
	"syscall"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func spawnServer(cl libkb.CommandLine, forkType keybase1.ForkType) (pid int, err error) {

	var files []uintptr
	var cmd string
	var args []string
	var devnull, log *os.File

	defer func() {
		if err != nil {
			if devnull != nil {
				devnull.Close()
			}
			if log != nil {
				log.Close()
			}
		}
	}()

	if devnull, err = os.OpenFile("nul", os.O_RDONLY, 0); err != nil {
		return
	}
	files = append(files, devnull.Fd())

	if G.Env.GetSplitLogOutput() {
		files = append(files, uintptr(1), uintptr(2))
	} else {
		if _, log, err = libkb.OpenLogFile(); err != nil {
			return
		}
		files = append(files, log.Fd(), log.Fd())
	}

	// On 'nix this would include Setsid: true, which means
	// the new process inherits the session/terminal from the parent.
	// This is default on windows and need not be specified.
	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Files: files,
	}

	cmd, args, err = makeServerCommandLine(cl, forkType)
	if err != nil {
		return
	}

	pid, _, err = syscall.StartProcess(cmd, args, &attr)
	if err != nil {
		err = fmt.Errorf("Error in StartProcess: %s", err)
	} else {
		G.Log.Info("Starting background server with pid=%d", pid)
	}
	return
}
