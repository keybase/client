// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"fmt"
	"os"
	"syscall"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const flagCreateNewConsole = 0x00000010

func spawnServer(g *libkb.GlobalContext, cl libkb.CommandLine, forkType keybase1.ForkType) (pid int, err error) {

	var files []uintptr
	var cmd string
	var args []string
	var devnull *os.File

	defer func() {
		if err != nil && devnull != nil {
			devnull.Close()
		}
	}()

	// Failing to open nul is non-fatal here.
	devnull, err = os.OpenFile("nul", os.O_RDONLY, 0)
	if err != nil {
		G.Log.Warning("Cannot open nul: %v", err)
		// 0 is an invalid handle, but more importantly it will
		// not be passed to DuplicateHandle by Go. This works
		// with Go 1.6, but is hacky. This code path is taken
		// only on systems that are broken to begin with...
		files = append(files, 0, 0, 0)
	} else {
		nullfd := devnull.Fd()
		files = append(files, nullfd, nullfd, nullfd)
	}

	// Create the process with its own console, so it
	// can outlive the parent process's console.
	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Files: files,
		Sys: &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: flagCreateNewConsole,
		},
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
