// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package watchdog

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/keybase/go-logging"
	"github.com/keybase/go-updater/process"
	"github.com/keybase/go-updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testLog = &logging.Logger{Module: "test"}

func TestWatchMultiple(t *testing.T) {
	procProgram1 := procProgram(t, "testWatch1", "sleep")
	procProgram2 := procProgram(t, "testWatch2", "sleep")
	defer util.RemoveFileAtPath(procProgram1.Path)
	defer util.RemoveFileAtPath(procProgram2.Path)

	delay := 10 * time.Millisecond

	err := Watch([]Program{procProgram1, procProgram2}, delay, testLog)
	require.NoError(t, err)

	matcher1 := process.NewMatcher(procProgram1.Path, process.PathEqual, testLog)
	procs1, err := process.FindProcesses(matcher1, time.Second, 200*time.Millisecond, testLog)
	require.NoError(t, err)
	assert.Equal(t, 1, len(procs1))

	matcher2 := process.NewMatcher(procProgram2.Path, process.PathEqual, testLog)
	procs2, err := process.FindProcesses(matcher2, time.Second, 200*time.Millisecond, testLog)
	require.NoError(t, err)
	require.Equal(t, 1, len(procs2))
	proc2 := procs2[0]

	err = process.TerminatePID(proc2.Pid(), time.Millisecond, testLog)
	require.NoError(t, err)

	time.Sleep(2 * delay)

	// Check for restart
	procs2After, err := process.FindProcesses(matcher2, time.Second, time.Millisecond, testLog)
	require.NoError(t, err)
	require.Equal(t, 1, len(procs2After))
}

// TestTerminateBeforeWatch checks to make sure any existing processes are
// terminated before a process is monitored.
func TestTerminateBeforeWatch(t *testing.T) {
	procProgram := procProgram(t, "testTerminateBeforeWatch", "sleep")
	defer util.RemoveFileAtPath(procProgram.Path)

	matcher := process.NewMatcher(procProgram.Path, process.PathEqual, testLog)

	// Launch program (so we can test it gets terminated on watch)
	err := exec.Command(procProgram.Path, procProgram.Args...).Start()
	require.NoError(t, err)

	procsBefore, err := process.FindProcesses(matcher, time.Second, time.Millisecond, testLog)
	require.NoError(t, err)
	require.Equal(t, 1, len(procsBefore))
	pidBefore := procsBefore[0].Pid()
	t.Logf("Pid before: %d", pidBefore)

	// Start watching
	err = Watch([]Program{procProgram}, 10*time.Millisecond, testLog)
	require.NoError(t, err)

	// Check again, and make sure it's a new process
	procsAfter, err := process.FindProcesses(matcher, time.Second, time.Millisecond, testLog)
	require.NoError(t, err)
	require.Equal(t, 1, len(procsAfter))
	pidAfter := procsAfter[0].Pid()
	t.Logf("Pid after: %d", pidAfter)

	assert.NotEqual(t, pidBefore, pidAfter)
}

func cleanupProc(cmd *exec.Cmd, procPath string) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	_ = os.Remove(procPath)
}

func TestExitOnSuccess(t *testing.T) {
	procProgram := procProgram(t, "testExitOnSuccess", "echo")
	procProgram.ExitOn = ExitOnSuccess
	defer util.RemoveFileAtPath(procProgram.Path)

	err := Watch([]Program{procProgram}, 0, testLog)
	require.NoError(t, err)

	time.Sleep(50 * time.Millisecond)

	matcher := process.NewMatcher(procProgram.Path, process.PathEqual, testLog)
	procsAfter, err := process.WaitForExit(matcher, 500*time.Millisecond, 50*time.Millisecond, testLog)
	require.NoError(t, err)
	assert.Equal(t, 0, len(procsAfter))
}

func procTestPath(name string) (string, string) {
	// Copy test executable to tmp
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("GOPATH"), "bin", "test.exe"), filepath.Join(os.TempDir(), name+".exe")
	}
	return filepath.Join(os.Getenv("GOPATH"), "bin", "test"), filepath.Join(os.TempDir(), name)
}

// procProgram returns a testable unique program at a temporary location
func procProgram(t *testing.T, name string, testCommand string) Program {
	path, procPath := procTestPath(name)
	err := util.CopyFile(path, procPath, testLog)
	require.NoError(t, err)
	err = os.Chmod(procPath, 0777)
	require.NoError(t, err)
	// Temp dir might have symlinks in which case we need the eval'ed path
	procPath, err = filepath.EvalSymlinks(procPath)
	require.NoError(t, err)
	return Program{
		Path: procPath,
		Args: []string{testCommand},
	}
}
