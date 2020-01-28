// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package watchdog

import (
	"os"
	"os/exec"
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
	Path   string
	Args   []string
	ExitOn ExitOn
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

func terminateExisting(programs []Program, log Log) {
	// Terminate any monitored processes
	// this logic also exists in the updater, so if you want to change it, look there too.
	ospid := os.Getpid()
	for _, program := range programs {
		matcher := process.NewMatcher(program.Path, process.PathEqual, log)
		matcher.ExceptPID(ospid)
		log.Infof("Terminating %s", program.Path)
		process.TerminateAll(matcher, time.Second, log)
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
