// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package watchdog

import (
	"io/ioutil"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/keybase/go-updater/process"
)

// ExitOn describes when a program should exit (not-restart)
type ExitOn string

const (
	// ExitOnNone means the program should always be restarted
	ExitOnNone ExitOn = ""
	// ExitOnSuccess means the program should only restart if errored
	ExitOnSuccess ExitOn = "success"
	// ExitAllOnSuccess means the program should only restart if errored,
	// otherwise exit this watchdog. Intended for Windows
	ExitAllOnSuccess ExitOn = "all"
)

// Program is a program at path with arguments
type Program struct {
	Path    string
	Args    []string
	ExitOn  ExitOn
	PidFile string
}

// Log is the logging interface for the watchdog package
type Log interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// Watch monitors programs and restarts them if they aren't running
func Watch(programs []Program, restartDelay time.Duration, log Log) error {
	// Terminate any existing programs that we are supposed to monitor
	log.Infof("Terminating any existing programs we will be monitoring")
	terminateExisting(programs, log)

	// any program can terminate everything if it's ExitAllOnSuccess
	exitAll := func() {
		log.Infof("Terminating any other programs we are monitoring")
		terminateExisting(programs, log)
		os.Exit(0)
	}
	// Start monitoring all the programs
	watchPrograms(programs, restartDelay, log, exitAll)

	return nil
}

func pidFileIsDeletable(terminatedPids []int, path string, log Log) (deletable bool) {
	pidFromFile, err := ioutil.ReadFile(path)
	if os.IsNotExist(err) {
		// pidfile was successfully cleaned up by the terminated process
		// or was never created
		return false
	}
	lockedPid, err := strconv.Atoi(string(pidFromFile))
	if err != nil {
		log.Infof("error reading pid from file after terminating program %s: %s", path, err.Error())
		return false
	}
	var terminatedPidIsStillLockedByFile bool
	for _, termPid := range terminatedPids {
		if termPid == lockedPid {
			terminatedPidIsStillLockedByFile = true
			break
		}
	}
	return terminatedPidIsStillLockedByFile
}

func (p Program) deletePidFileIfTerminated(terminatedPids []int, log Log) {
	if p.PidFile == "" {
		// there is no pidfile on this program
		return
	}
	var err error
	timeout := time.NewTimer(3 * time.Second)
	for {
		select {
		case <-time.After(300 * time.Millisecond):
			if !pidFileIsDeletable(terminatedPids, p.PidFile, log) {
				return
			}
			err = os.Remove(p.PidFile)
			if err != nil {
				log.Infof("unable to delete a pidfile %s: %s", p.PidFile, err.Error())
				continue
			}
			log.Infof("successfully deleted a pidfile %s", p.PidFile)
			return
		case <-timeout.C:
			// time out
			log.Infof("timed out trying to delete a pidfile %s", p.PidFile)
			return
		}
	}
}

// terminate will send a kill signal to the program by finding its pid from the
// path to its executable. If the program has specified a pidfile, this function
// will open up that file and see if the pid in there matches the pid that was just
// terminated. If so, this function will delete the file. It is much better for
// programs to manage their own pidfiles, but kill signals cannot always be caught
// and handled gracefully (i.e. in windows).
func (p Program) terminate(log Log) {
	log.Infof("Terminating %s", p.Path)
	thisProcess := os.Getpid()
	matcher := process.NewMatcher(p.Path, process.PathEqual, log)
	matcher.ExceptPID(thisProcess)
	// this logic also exists in the updater, so if you want to change it, look there too.
	terminatedPids := process.TerminateAll(matcher, time.Second, log)
	if len(terminatedPids) == 0 {
		// nothing terminated probably because nothing was running
		return
	}
	// if there was a pidfile, it might not have been cleaned up, so let's take a look
	p.deletePidFileIfTerminated(terminatedPids, log)
}

func terminateExisting(programs []Program, log Log) {
	// Terminate any monitored processes
	for _, p := range programs {
		p.terminate(log)
	}
}

func watchPrograms(programs []Program, delay time.Duration, log Log, exitAll func()) {
	for _, program := range programs {
		go watchProgram(program, delay, log, exitAll)
	}
}

// watchProgram will monitor a program and restart it if it exits.
// This method will run forever.
func watchProgram(program Program, restartDelay time.Duration, log Log, exitAll func()) {
	for {
		start := time.Now()
		log.Infof("Starting %#v", program)
		cmd := exec.Command(program.Path, program.Args...)
		err := cmd.Run()
		if err != nil {
			log.Errorf("Error running program: %q; %s", program, err)
		} else {
			log.Infof("Program finished: %q", program)
			if program.ExitOn == ExitOnSuccess {
				log.Infof("Program configured to exit on success, not restarting")
				break
			} else if program.ExitOn == ExitAllOnSuccess {
				log.Infof("Program configured to exit on success, exiting")
				exitAll()
			}
		}
		log.Infof("Program ran for %s", time.Since(start))
		if time.Since(start) < restartDelay {
			log.Infof("Waiting %s before trying to start command again", restartDelay)
			time.Sleep(restartDelay)
		}
	}
}
