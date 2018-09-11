// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux netbsd openbsd solaris

package client

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func spawnServer(g *libkb.GlobalContext, cl libkb.CommandLine, forkType keybase1.ForkType) (pid int, err error) {

	// If we're running under systemd, start the service as a user unit instead
	// of forking it directly. We do this here in the generic auto-fork branch,
	// rather than a higher-level systemd branch, because we want to handle the
	// case where the service was previously autoforked, and then the user
	// upgrades their keybase package to a version with systemd support. The
	// flock-checking code will short-circuit before we get here, if the
	// service is running, so we don't have to worry about a conflict.
	//
	// We only do this in prod mode, because keybase.service always starts
	// /usr/bin/keybase, which is probably not what you want if you're
	// autoforking in dev mode. To run the service you just built in prod mode,
	// you can either do `keybase --run-mode=prod service` manually, or you can
	// add a systemd override file (see https://askubuntu.com/q/659267/73244).
	if g.Env.WantsSystemd() {
		g.Log.Info("Starting keybase.service.")
		// Prefer "restart" to "start" so that we don't race against shutdown.
		startCmd := exec.Command("systemctl", "--user", "restart", "keybase.service")
		startCmd.Stdout = os.Stderr
		startCmd.Stderr = os.Stderr
		err = startCmd.Run()
		if err != nil {
			g.Log.Error("Failed to start keybase.service.")
		}
		return
	}

	var files []uintptr
	var cmd string
	var args []string
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

	cmd, args, err = makeServerCommandLine(g, cl, forkType)
	if err != nil {
		return
	}

	pid, err = syscall.ForkExec(cmd, args, &attr)
	if err != nil {
		err = fmt.Errorf("Error in ForkExec: %s", err)
	} else {
		g.Log.Info("Forking background server with pid=%d", pid)
	}
	return
}
