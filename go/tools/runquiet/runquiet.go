// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// Windows utility for silently starting console processes
// without showing a console.
// Must be built with -ldflags "-H windowsgui"

// +build windows

package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"time"
)

const flagCreateNewConsole = 0x00000010

func main() {
	argsIndex := 1 // 0 is the name of this program, 1 is either the one to launch or the "wait" option

	if len(os.Args) < 2 {
		log.Fatal("ERROR: no arguments. Use [-wait] programname [arg arg arg]\n")
	}

	// Do this awkward thing so we can pass along the rest of the command line as-is

	doWait := false
	doHide := true
	for i := 1; i < 3 && (i+1) < len(os.Args); i++ {
		if strings.EqualFold(os.Args[argsIndex], "-wait") {
			argsIndex++
			doWait = true
		} else if strings.EqualFold(os.Args[argsIndex], "-show") {
			argsIndex++
			doHide = false
		}
	}

	attr := &syscall.ProcAttr{
		Files: []uintptr{uintptr(syscall.Stdin), uintptr(syscall.Stdout), uintptr(syscall.Stderr)},
		Env:   syscall.Environ(),
		Sys: &syscall.SysProcAttr{
			HideWindow:    doHide,
			CreationFlags: flagCreateNewConsole,
		},
	}
	fmt.Printf("Launching %s with args %v\n", os.Args[argsIndex], os.Args[argsIndex:])
	pid, handle, err := syscall.StartProcess(os.Args[argsIndex], os.Args[argsIndex:], attr)
	fmt.Printf("%v, %v, %v\n", pid, handle, err)
	if doWait {
		p, err := os.FindProcess(pid)
		if err != nil {
			fmt.Printf("Launcher can't find %d\n", pid)
		}

		pstate, err := p.Wait()

		if err == nil && pstate.Success() {
			time.Sleep(100 * time.Millisecond)
		} else {
			fmt.Printf("Unsuccessful wait: Error %v, pstate %v\n", err, *pstate)
		}
	}
}
