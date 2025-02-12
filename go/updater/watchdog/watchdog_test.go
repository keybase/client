//go:build !windows
// +build !windows

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package watchdog

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/updater/process"
	"github.com/keybase/client/go/updater/util"
	"github.com/keybase/go-logging"
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

// TestTerminateBeforeWatchRace verifies protection from the following scenario:
//
//	watchdog1 starts up
//	watchdog1 looks up existing processes to terminate and sees none
//	watchdog2 starts up
//	watchdog2 looks up existing processes to terminate and sees watchdog1
//	watchdog1 starts PROGRAM
//	watchdog1 receives kill signal from watchdog2 and dies
//	watchdog2 starts a second PROGRAM
//	PROGRAM has a bad time
//
// The test doesn't protect us from the race condition generically, rather only when:
//
//	(1) PROGRAM is only started by a watchdog, and
//	(2) PROGRAM and watchdog share a path to the same executable. When a
//		watchdog looks up existing processes to terminate, it needs to be able
//		to find another watchdog.
func TestTerminateBeforeWatchRace(t *testing.T) {
	var err error
	// set up a bunch of iterations of the same program
	programName := "TestTerminateBeforeWatchRace"
	otherIterations := make([]Program, 6)
	for i := 0; i < 6; i++ {
		otherIterations[i] = procProgram(t, programName, "sleep")
	}
	mainProgram := procProgram(t, programName, "sleep")
	defer util.RemoveFileAtPath(mainProgram.Path)
	blocker := make(chan struct{})
	go func() {
		for _, p := range otherIterations[:3] {
			_ = exec.Command(p.Path, p.Args...).Start()
		}
		blocker <- struct{}{}
		for _, p := range otherIterations[3:] {
			_ = exec.Command(p.Path, p.Args...).Start()
		}
	}()

	// block until we definitely have something to kill
	<-blocker
	err = Watch([]Program{mainProgram}, 10*time.Millisecond, testLog)
	require.NoError(t, err)

	// Check and make sure there's only one of these processes running
	matcher := process.NewMatcher(mainProgram.Path, process.PathEqual, testLog)
	procsAfter, err := process.FindProcesses(matcher, time.Second, time.Millisecond, testLog)
	require.NoError(t, err)
	require.Equal(t, 1, len(procsAfter))
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
	// if runtime.GOOS == "windows" {
	//	return filepath.Join(os.Getenv("GOPATH"), "bin", "test.exe"), filepath.Join(os.TempDir(), name+".exe")
	//}
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
		Name: name,
	}
}

// TestExitAllOnSuccess verifies that a program with ExitAllOnSuccess that exits cleanly
// will also cause a clean exit on another program which has been restarted by the watchdog.
func TestExitAllOnSuccess(t *testing.T) {
	t.Skip("flakey :(")
	// This test is slow and I'm sorry about that.
	sleepTimeInTest := 10000 // 10 seconds
	exiter := procProgram(t, "testExitAllOnSuccess", "sleep")
	defer util.RemoveFileAtPath(exiter.Path)
	exiter.ExitOn = ExitAllOnSuccess
	testProgram := procProgram(t, "alice", "sleep")
	defer util.RemoveFileAtPath(testProgram.Path)

	getProgramPID := func(program Program) int {
		matcher := process.NewMatcher(program.Path, process.PathEqual, testLog)
		procs, err := process.FindProcesses(matcher, time.Second, 100*time.Millisecond, testLog)
		require.NoError(t, err)
		require.Equal(t, 1, len(procs))
		proc := procs[0]
		return proc.Pid()
	}

	// watch two programs, 1 that will exit cleanly and 1 that won't
	programs := []Program{exiter, testProgram}
	err := Watch(programs, 0, testLog)
	require.NoError(t, err)

	// bounce the testProgram halfway through the sleep interval
	firstPid := getProgramPID(testProgram)
	require.NotEqual(t, 0, firstPid)
	time.Sleep(time.Duration(sleepTimeInTest/2) * time.Second)
	err = process.TerminatePID(firstPid, time.Millisecond, testLog)
	require.NoError(t, err)
	time.Sleep(100 * time.Millisecond)
	secondPid := getProgramPID(testProgram)
	require.NotEqual(t, 0, secondPid)
	require.NotEqual(t, firstPid, secondPid)

	// sleep until the exiter program should have exited cleanly
	// and triggered the exit of everything else
	time.Sleep(time.Duration((sleepTimeInTest/2)+1) * time.Second)

	assertProgramEnded := func(program Program) {
		matcher := process.NewMatcher(program.Path, process.PathEqual, testLog)
		procs, err := process.FindProcesses(matcher, time.Second, 100*time.Millisecond, testLog)
		require.NoError(t, err)
		require.Equal(t, 0, len(procs))
	}

	assertProgramEnded(exiter)
	assertProgramEnded(testProgram)
}

func TestWatchdogExitAllRace(t *testing.T) {
	t.Skip("flakey :(")
	exiter := procProgram(t, "TestWatchdogExitAllRace", "sleep")
	defer util.RemoveFileAtPath(exiter.Path)
	exiter.ExitOn = ExitAllOnSuccess
	procProgram1 := procProgram(t, "alice", "sleep")
	defer util.RemoveFileAtPath(procProgram1.Path)
	procProgram2 := procProgram(t, "bob", "sleep")
	defer util.RemoveFileAtPath(procProgram2.Path)

	assertOneProcessIsRunning := func(p Program) {
		matcher := process.NewMatcher(p.Path, process.PathEqual, testLog)
		procs, err := process.FindProcesses(matcher, time.Second, 200*time.Millisecond, testLog)
		require.NoError(t, err)
		assert.Equal(t, 1, len(procs))
	}
	assertOneProcessOfEachProgramIsRunning := func() {
		assertOneProcessIsRunning(exiter)
		assertOneProcessIsRunning(procProgram1)
		assertOneProcessIsRunning(procProgram2)
	}

	// spin up three watchdogs at the same time with the same three programs
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := Watch([]Program{exiter, procProgram1, procProgram2}, 0, testLog)
			require.NoError(t, err)
		}()
	}
	wg.Wait()
	assertOneProcessOfEachProgramIsRunning()
	time.Sleep(500 * time.Millisecond)
	assertOneProcessOfEachProgramIsRunning()

	err := Watch([]Program{exiter, procProgram1, procProgram2}, 0, testLog)
	require.NoError(t, err)
	assertOneProcessOfEachProgramIsRunning()
}
