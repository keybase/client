// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lsof

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
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
	require.NoError(t, err)

	require.Len(t, processes, 2, "Invalid processes: %#v", processes)

	process1 := processes[0]
	require.False(t, process1.PID != "10292" || process1.Command != "bash" || process1.UserID != "501",
		"Invalid process: %#v", process1)

	process2 := processes[1]
	require.False(t, process2.PID != "10561" || process2.Command != "vim" || process2.UserID != "501",
		"Invalid process: %#v", process2)
	require.Len(t, process2.FileDescriptors, 2, "Invalid file descriptors: %#v", process2.FileDescriptors)
	p2fd1 := process2.FileDescriptors[0]
	require.False(t, p2fd1.FD != "cwd" || p2fd1.Type != FileTypeDir || p2fd1.Name != "/keybase/private/gabrielh,oconnor663",
		"Invalid file descriptor: %#v", p2fd1)
	p2fd2 := process2.FileDescriptors[1]
	require.False(t, p2fd2.FD != "4" || p2fd2.Type != FileTypeFile || p2fd2.Name != "/keybase/private/gabrielh,oconnor663/.fun_times.swp",
		"Invalid file descriptor: %#v", p2fd2)
}

func TestParseEmpty(t *testing.T) {
	processes, err := parse("")
	require.NoError(t, err)
	require.Empty(t, processes, "Failed parsing empty")
}

func TestParseSkipInvalidField(t *testing.T) {
	s := `p10561
cvim
u501
fcwd
tDIR
Binvalidfield`

	processes, err := parse(s)
	require.NoError(t, err)
	require.Len(t, processes, 1, "Failed parsing")
}

func TestInvalidDir(t *testing.T) {
	invalidDir := filepath.Join(os.Getenv("HOME"), "invaliddir")
	_, err := MountPoint(invalidDir)
	t.Logf("Error: %#v", err)
	require.Error(t, err,
		"Should have errored")
}
