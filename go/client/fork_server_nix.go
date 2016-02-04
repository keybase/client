// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux netbsd openbsd solaris

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
	var devnull *os.File

	defer func() {
		if err != nil {
			if devnull != nil {
				devnull.Close()
			}
		}
	}()

	if devnull, err = os.OpenFile("/dev/null", os.O_RDONLY, 0); err != nil {
		return
	}
	files = append(files, devnull.Fd())
	files = append(files, uintptr(1), uintptr(2))

	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Sys:   &syscall.SysProcAttr{Setsid: true},
		Files: files,
	}

	cmd, args, err = makeServerCommandLine(cl, forkType)
	if err != nil {
		return
	}

	pid, err = syscall.ForkExec(cmd, args, &attr)
	if err != nil {
		err = fmt.Errorf("Error in ForkExec: %s", err)
	} else {
		G.Log.Info("Forking background server with pid=%d", pid)
	}
	return
}
