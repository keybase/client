// +build darwin dragonfly freebsd linux netbsd openbsd solaris

package client

import (
	"fmt"
	"os"
	"syscall"

	"github.com/keybase/client/go/libkb"
)

func spawnServer(cl libkb.CommandLine) (err error) {

	var files []uintptr
	var cmd string
	var args []string
	var devnull, log *os.File
	var pid int

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

	if devnull, err = os.OpenFile("/dev/null", os.O_RDONLY, 0); err != nil {
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

	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Sys:   &syscall.SysProcAttr{Setsid: true},
		Files: files,
	}

	cmd, args, err = makeServerCommandLine(cl)
	if err != nil {
		return err
	}

	pid, err = syscall.ForkExec(cmd, args, &attr)
	if err != nil {
		err = fmt.Errorf("Error in ForkExec: %s", err)
	} else {
		G.Log.Info("Forking background server with pid=%d", pid)
	}
	return err
}
