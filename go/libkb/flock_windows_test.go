// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"os"
	"os/exec"
	"syscall"
	"testing"
)

func exists(name string) bool {
	_, err := os.Stat(name)
	return !os.IsNotExist(err)
}

// run runs arg command. It retrns error if command could not be run.
// If command did run, the function will return error == nil and
// integer command exit code.
func run(arg ...string) (int, error) {
	err := exec.Command(arg[0], arg[1:]...).Run()
	if err != nil {
		if e2, ok := err.(*exec.ExitError); ok {
			if s, ok := e2.Sys().(syscall.WaitStatus); ok {
				return int(s.ExitCode), nil
			}
		}
		return 0, err
	}
	return 0, nil
}

func TestLockPIDFile_windows(t *testing.T) {

	lpFile := NewLockPIDFile("TestLockPIDWin")
	err := lpFile.Lock()

	if !exists("TestLockPIDWin") {
		t.Fatalf("LockPIDFile: file creation failed")
	} else if err != nil {
		t.Fatalf("LockPIDFile failed: %v", err)
	} else {
		// External process should be blocked from deleting the file
		run("cmd", "/c", "del", "TestLockPIDWin")
		if !exists("TestLockPIDWin") {
			t.Fatalf("LockPIDFile: expected error deleting locked file")
		}
	}
	lpFile.Close()

	// External process should be able to delete the file now
	exitcode, err := run("cmd", "/c", "del", "TestLockPIDWin")
	if err != nil || exitcode != 0 || exists("TestLockPIDWin") {
		t.Fatalf("LockPIDFile: exe.Command(del) failed: %v", err)
	}
}
