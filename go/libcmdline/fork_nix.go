// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux netbsd openbsd solaris

package libcmdline

import (
	"os"
	"syscall"

	"github.com/keybase/client/go/logger"
)

// SpawnDetachedProcess spawns a background process and detech from the calling
// process.
func SpawnDetachedProcess(
	cmd string, args []string, _ logger.Logger) (pid int, err error) {
	var files []uintptr
	var devnull *os.File

	defer func() {
		if err != nil && devnull != nil {
			devnull.Close()
		}
	}()

	if devnull, err = os.OpenFile("/dev/null", os.O_RDONLY, 0); err != nil {
		return
	}
	nullfd := devnull.Fd()
	files = append(files, nullfd, nullfd, nullfd)

	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Sys:   &syscall.SysProcAttr{Setsid: true},
		Files: files,
	}

	pid, err = syscall.ForkExec(cmd, args, &attr)
	return pid, err
}
