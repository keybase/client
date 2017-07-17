// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lsof

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParse(t *testing.T) {
	s := `p10292
cbash
u501
fcwd
tDIR
n/keybase/private/gabrielh,oconnor663
p10561
cvim
u501
fcwd
tDIR
n/keybase/private/gabrielh,oconnor663
f4
tREG
n/keybase/private/gabrielh,oconnor663/.fun_times.swp
`

	processes, err := parse(s)
	if err != nil {
		t.Fatal(err)
	}

	if len(processes) != 2 {
		t.Fatalf("Invalid processes: %#v", processes)
	}

	process1 := processes[0]
	if process1.PID != "10292" || process1.Command != "bash" || process1.UserID != "501" {
		t.Fatalf("Invalid process: %#v", process1)
	}

	process2 := processes[1]
	if process2.PID != "10561" || process2.Command != "vim" || process2.UserID != "501" {
		t.Fatalf("Invalid process: %#v", process2)
	}
	if len(process2.FileDescriptors) != 2 {
		t.Fatalf("Invalid file descriptors: %#v", process2.FileDescriptors)
	}
	p2fd1 := process2.FileDescriptors[0]
	if p2fd1.FD != "cwd" || p2fd1.Type != FileTypeDir || p2fd1.Name != "/keybase/private/gabrielh,oconnor663" {
		t.Fatalf("Invalid file descriptor: %#v", p2fd1)
	}
	p2fd2 := process2.FileDescriptors[1]
	if p2fd2.FD != "4" || p2fd2.Type != FileTypeFile || p2fd2.Name != "/keybase/private/gabrielh,oconnor663/.fun_times.swp" {
		t.Fatalf("Invalid file descriptor: %#v", p2fd2)
	}
}

func TestParseEmpty(t *testing.T) {
	processes, err := parse("")
	if err != nil {
		t.Fatal(err)
	}
	if len(processes) != 0 {
		t.Fatal("Failed parsing empty")
	}
}

func TestParseSkipInvalidField(t *testing.T) {
	s := `p10561
cvim
u501
fcwd
tDIR
Binvalidfield`

	processes, err := parse(s)
	if err != nil {
		t.Fatal(err)
	}
	if len(processes) != 1 {
		t.Fatal("Failed parsing")
	}
}

func TestInvalidDir(t *testing.T) {
	invalidDir := filepath.Join(os.Getenv("HOME"), "invaliddir")
	_, err := MountPoint(invalidDir)
	t.Logf("Error: %#v", err)
	if err == nil {
		t.Fatal("Should have errored")
	}
}
