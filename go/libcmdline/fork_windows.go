// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libcmdline

import (
	"os"
	"syscall"

	"github.com/keybase/client/go/logger"
)

const flagCreateNewConsole = 0x00000010

// SpawnDetachedProcess spawns a background process and detech from the calling
// process.
func SpawnDetachedProcess(
	cmd string, args []string, log logger.Logger) (pid int, err error) {
	var files []uintptr
	var devnull *os.File

	defer func() {
		if err != nil && devnull != nil {
			devnull.Close()
		}
	}()

	// Failing to open nul is non-fatal here.
	devnull, err = os.OpenFile("nul", os.O_RDONLY, 0)
	if err != nil {
		log.Warning("Cannot open nul: %v", err)
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

	pid, _, err = syscall.StartProcess(cmd, args, &attr)
	return pid, err
}
