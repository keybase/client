// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package process

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/keybase/go-logging"
	"github.com/keybase/go-ps"
	"github.com/keybase/go-updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testLog = &logging.Logger{Module: "test"}

var matchAll = func(p ps.Process) bool { return true }

func cleanupProc(cmd *exec.Cmd, procPath string) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	if procPath != "" {
		_ = os.Remove(procPath)
	}
}

func procTestPath(name string) (string, string) {
	// Copy test executable to tmp
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("GOPATH"), "bin", "test.exe"), filepath.Join(os.TempDir(), name+".exe")
	}
	return filepath.Join(os.Getenv("GOPATH"), "bin", "test"), filepath.Join(os.TempDir(), name)
}

func procPath(t *testing.T, name string) string {
	// Copy test executable to tmp
	srcPath, destPath := procTestPath(name)
	err := util.CopyFile(srcPath, destPath, testLog)
	require.NoError(t, err)
	err = os.Chmod(destPath, 0777)
	require.NoError(t, err)
	// Temp dir might have symlinks in which case we need the eval'ed path
	destPath, err = filepath.EvalSymlinks(destPath)
	require.NoError(t, err)
	return destPath
}

func TestFindPIDsWithFn(t *testing.T) {
	pids, err := findPIDsWithFn(ps.Processes, matchAll, testLog)
	assert.NoError(t, err)
	assert.True(t, len(pids) > 1)

	fn := func() ([]ps.Process, error) {
		return nil, fmt.Errorf("Testing error")
	}
	processes, err := findPIDsWithFn(fn, matchAll, testLog)
	assert.Nil(t, processes)
	assert.Error(t, err)

	fn = func() ([]ps.Process, error) {
		return nil, nil
	}
	processes, err = findPIDsWithFn(fn, matchAll, testLog)
	assert.Equal(t, []int{}, processes)
	assert.NoError(t, err)
}

func TestTerminatePID(t *testing.T) {
	procPath := procPath(t, "testTerminatePID")
	cmd := exec.Command(procPath, "sleep")
	err := cmd.Start()
	defer cleanupProc(cmd, procPath)
	require.NoError(t, err)
	require.NotNil(t, cmd.Process)

	err = TerminatePID(cmd.Process.Pid, time.Millisecond, testLog)
	assert.NoError(t, err)
}

func assertTerminated(t *testing.T, pid int, stateStr string) {
	process, err := os.FindProcess(pid)
	require.NoError(t, err)
	state, err := process.Wait()
	require.NoError(t, err)
	assert.Equal(t, stateStr, state.String())
}

func TestTerminatePIDInvalid(t *testing.T) {
	err := TerminatePID(-5, time.Millisecond, testLog)
	assert.Error(t, err)
}

func TestTerminateAllFn(t *testing.T) {
	fn := func() ([]ps.Process, error) {
		return nil, fmt.Errorf("Testing error")
	}
	TerminateAllWithProcessesFn(fn, matchAll, time.Millisecond, testLog)

	fn = func() ([]ps.Process, error) {
		return nil, nil
	}
	TerminateAllWithProcessesFn(fn, matchAll, time.Millisecond, testLog)
}

func startProcess(t *testing.T, path string, testCommand string) (string, int, *exec.Cmd) {
	cmd := exec.Command(path, testCommand)
	err := cmd.Start()
	require.NoError(t, err)
	require.NotNil(t, cmd.Process)
	return path, cmd.Process.Pid, cmd
}

func TestTerminateAllPathEqual(t *testing.T) {
	procPath := procPath(t, "testTerminateAllPathEqual")
	defer util.RemoveFileAtPath(procPath)
	matcher := NewMatcher(procPath, PathEqual, testLog)
	testTerminateAll(t, procPath, matcher, 2)
}

func TestTerminateAllExecutableEqual(t *testing.T) {
	procPath := procPath(t, "testTerminateAllExecutableEqual")
	defer util.RemoveFileAtPath(procPath)
	matcher := NewMatcher(filepath.Base(procPath), ExecutableEqual, testLog)
	testTerminateAll(t, procPath, matcher, 2)
}

func TestTerminateAllPathContains(t *testing.T) {
	procPath := procPath(t, "testTerminateAllPathContains")
	defer util.RemoveFileAtPath(procPath)
	procDir, procFile := filepath.Split(procPath)
	match := procDir[1:] + procFile[:20]
	t.Logf("Match: %q", match)
	matcher := NewMatcher(match, PathContains, testLog)
	testTerminateAll(t, procPath, matcher, 2)
}

func TestTerminateAllPathPrefix(t *testing.T) {
	procPath := procPath(t, "testTerminateAllPathPrefix")
	defer util.RemoveFileAtPath(procPath)
	procDir, procFile := filepath.Split(procPath)
	match := procDir + procFile[:20]
	t.Logf("Match: %q", match)
	matcher := NewMatcher(match, PathPrefix, testLog)
	testTerminateAll(t, procPath, matcher, 2)
}

func testTerminateAll(t *testing.T, path string, matcher Matcher, numProcs int) {
	var exitStatus string
	if runtime.GOOS == "windows" {
		exitStatus = "exit status 1"
	} else {
		exitStatus = "signal: terminated"
	}

	pids := []int{}
	for i := 0; i < numProcs; i++ {
		procPath, pid, cmd := startProcess(t, path, "sleep")
		t.Logf("Started process %q (%d)", procPath, pid)
		pids = append(pids, pid)
		defer cleanupProc(cmd, "")
	}

	time.Sleep(time.Second)

	terminatePids := TerminateAll(matcher, time.Second, testLog)
	for _, p := range pids {
		assert.Contains(t, terminatePids, p)
		assertTerminated(t, p, exitStatus)
	}
}

func TestFindProcessWait(t *testing.T) {
	procPath := procPath(t, "testFindProcessWait")
	cmd := exec.Command(procPath, "sleep")
	defer cleanupProc(cmd, procPath)

	// Ensure it's not already running
	procs, err := FindProcesses(NewMatcher(procPath, PathEqual, testLog), time.Millisecond, 0, testLog)
	require.NoError(t, err)
	require.Equal(t, 0, len(procs))

	go func() {
		time.Sleep(10 * time.Millisecond)
		startErr := cmd.Start()
		require.NoError(t, startErr)
	}()

	// Wait up to second for process to be running
	procs, err = FindProcesses(NewMatcher(procPath, PathEqual, testLog), time.Second, 10*time.Millisecond, testLog)
	require.NoError(t, err)
	require.True(t, len(procs) == 1)
}
