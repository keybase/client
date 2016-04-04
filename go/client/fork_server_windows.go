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

func spawnServer(g *libkb.GlobalContext, cl libkb.CommandLine, forkType keybase1.ForkType) (pid int, err error) {

	var files []uintptr
	var cmd string
	var args []string
	var devnull *os.File

	defer func() {
		if err != nil {
			if devnull != nil {
				devnull.Close()
			}
		}
	}()

	// Failing to open nul is non-fatal here.
	devnull, err = os.OpenFile("nul", os.O_RDONLY, 0)
	if err != nil {
		G.Log.Warning("Cannot open nul: %v", err)
	} else {
		nullfd := devnull.Fd()
		files = append(files, nullfd, nullfd, nullfd)
	}

	// On 'nix this would include Setsid: true, which means
	// the new process inherits the session/terminal from the parent.
	// This is default on windows and need not be specified.
	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Files: files,
	}

	cmd, args, err = makeServerCommandLine(g, cl, forkType)
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
