// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package process

import (
	"fmt"
	"os"
	"runtime"
	"syscall"
	"time"

	"github.com/keybase/go-ps"
)

// Log is the logging interface for the process package
type Log interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type processesFn func() ([]ps.Process, error)
type breakFn func([]ps.Process) bool

// FindProcesses returns processes containing string matching process path
func FindProcesses(matcher Matcher, wait time.Duration, delay time.Duration, log Log) ([]ps.Process, error) {
	breakFn := func(procs []ps.Process) bool {
		return len(procs) > 0
	}
	return findProcesses(matcher, breakFn, wait, delay, log)
}

// WaitForExit returns processes (if any) that are still running after wait
func WaitForExit(matcher Matcher, wait time.Duration, delay time.Duration, log Log) ([]ps.Process, error) {
	breakFn := func(procs []ps.Process) bool {
		return len(procs) == 0
	}
	return findProcesses(matcher, breakFn, wait, delay, log)
}

func findProcesses(matcher Matcher, breakFn breakFn, wait time.Duration, delay time.Duration, log Log) ([]ps.Process, error) {
	start := time.Now()
	for {
		log.Debugf("Find process %s (%s < %s)", matcher.match, time.Since(start), wait)
		procs, err := findProcessesWithFn(ps.Processes, matcher.Fn(), 0)
		if err != nil {
			return nil, err
		}
		if breakFn(procs) {
			return procs, nil
		}
		if time.Since(start) >= wait {
			break
		}
		time.Sleep(delay)
	}
	return nil, nil
}

// findProcessWithPID returns a process for a pid.
// Consider using os.FindProcess instead if suitable since this may be
// inefficient.
func findProcessWithPID(pid int) (ps.Process, error) {
	matchPID := func(p ps.Process) bool { return p.Pid() == pid }
	procs, err := findProcessesWithFn(ps.Processes, matchPID, 1)
	if err != nil {
		return nil, err
	}
	if len(procs) == 0 {
		return nil, nil
	}
	return procs[0], nil
}

// Currently findProcessWithPID is only used in tests, ignore deadcode warning
var _ = findProcessWithPID

// findProcessesWithFn finds processes using match function.
// If max is != 0, then we will return that max number of processes.
func findProcessesWithFn(fn processesFn, matchFn MatchFn, max int) ([]ps.Process, error) {
	processes, err := fn()
	if err != nil {
		return nil, fmt.Errorf("Error listing processes: %s", err)
	}
	if processes == nil {
		return nil, nil
	}
	procs := []ps.Process{}
	for _, p := range processes {
		if matchFn(p) {
			procs = append(procs, p)
		}
		if max != 0 && len(procs) >= max {
			break
		}
	}
	return procs, nil
}

// FindPIDsWithMatchFn returns pids for processes matching function
func FindPIDsWithMatchFn(matchFn MatchFn, log Log) ([]int, error) {
	return findPIDsWithFn(ps.Processes, matchFn, log)
}

func findPIDsWithFn(fn processesFn, matchFn MatchFn, log Log) ([]int, error) {
	procs, err := findProcessesWithFn(fn, matchFn, 0)
	if err != nil {
		return nil, err
	}
	pids := []int{}
	for _, p := range procs {
		pids = append(pids, p.Pid())
	}
	return pids, nil
}

// TerminateAll stops all processes with executable names that contains the matching string.
// It returns the pids that were terminated.
// This method only logs errors, if you need error handling, you can should use a different implementation.
func TerminateAll(matcher Matcher, killDelay time.Duration, log Log) []int {
	return TerminateAllWithProcessesFn(ps.Processes, matcher.Fn(), killDelay, log)
}

// TerminateAllWithProcessesFn stops processes processesFn that satify the matchFn.
// It returns the pids that were terminated.
// This method only logs errors, if you need error handling, you can should use a different implementation.
func TerminateAllWithProcessesFn(fn processesFn, matchFn MatchFn, killDelay time.Duration, log Log) (pids []int) {
	pids, err := findPIDsWithFn(fn, matchFn, log)
	if err != nil {
		log.Errorf("Error finding process: %s", err)
		return
	}
	if len(pids) == 0 {
		return
	}
	for _, pid := range pids {
		if err := TerminatePID(pid, killDelay, log); err != nil {
			log.Errorf("Error terminating %d: %s", pid, err)
		}
	}
	return
}

// TerminatePID is an overly simple way to terminate a PID.
// On darwin and linux, it calls SIGTERM, then waits a killDelay and then calls
// SIGKILL. We don't mind if we call SIGKILL on an already terminated process,
// since there could be a race anyway where the process exits right after we
// check if it's still running but before the SIGKILL.
// The killDelay is not used on windows.
func TerminatePID(pid int, killDelay time.Duration, log Log) error {
	log.Debugf("Searching OS for %d", pid)
	process, err := os.FindProcess(pid)
	if err != nil {
		return fmt.Errorf("Error finding OS process: %s", err)
	}
	if process == nil {
		return fmt.Errorf("No process found with pid %d", pid)
	}

	// Sending SIGTERM is not supported on windows, so we can use process.Kill()
	if runtime.GOOS == "windows" {
		return process.Kill()
	}

	log.Debugf("Terminating: %#v", process)
	err = process.Signal(syscall.SIGTERM)
	if err != nil {
		log.Warningf("Error sending terminate: %s", err)
	}
	time.Sleep(killDelay)
	// Ignore SIGKILL error since it will be that the process wasn't running if
	// the terminate above succeeded. If terminate didn't succeed above, then
	// this SIGKILL is a measure of last resort, and an error would signify that
	// something in the environment has gone terribly wrong.
	_ = process.Kill()
	return err
}
