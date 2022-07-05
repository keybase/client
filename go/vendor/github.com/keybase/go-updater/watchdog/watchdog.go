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

const terminationDelay = 200 * time.Millisecond
const heartbealDelay = 1 * time.Hour

// Program is a program at path with arguments
type Program struct {
	Path       string
	Name       string
	Args       []string
	ExitOn     ExitOn
	runningPid int
}

// Log is the logging interface for the watchdog package
type Log interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type Watchdog struct {
	Programs     []Program
	RestartDelay time.Duration
	Log          Log
	shutdownCh   chan (struct{})
}

func Watch(programs []Program, restartDelay time.Duration, log Log) error {
	w := Watchdog{
		Programs:     programs,
		RestartDelay: restartDelay,
		Log:          log,
		shutdownCh:   make(chan struct{}),
	}
	w.Log.Infof("Terminating any existing programs we will be monitoring")
	w.terminateExistingMatches()
	// Start monitoring all the programs
	w.Log.Infof("about to start %+v\n", w.Programs)
	for idx := range w.Programs {
		// modifies the underlying
		go w.startProgram(idx)
	}
	go w.heartbeatToLog(heartbealDelay)
	return nil
}

func (w *Watchdog) Shutdown() {
	w.Log.Infof("attempting a graceful exit of all of the watchdog's programs")
	close(w.shutdownCh)
	time.Sleep(terminationDelay)
	for i := 1; i <= 3; i++ {
		for _, p := range w.Programs {
			_ = p.dieIfRunning(w.Log)
		}
		time.Sleep(terminationDelay)
	}
	w.Log.Infof("done terminating all watched programs - exiting process")
	os.Exit(0)
}

func (p *Program) dieIfRunning(log Log) bool {
	if p.runningPid != 0 {
		log.Infof("%s running at %d is asked to die", p.Name, p.runningPid)
		_ = process.TerminatePID(p.runningPid, terminationDelay, log)
		p.runningPid = 0
		return true
	}
	log.Debugf("%s did not appear to be running so it was not terminated", p.Name)
	return false
}

func (p *Program) Run(log Log, shutdownCh chan struct{}) (err error) {
	p.dieIfRunning(log)
	cmd := exec.Command(p.Path, p.Args...)
	if err = cmd.Start(); err != nil {
		log.Errorf("Error starting %#v, err: %s", p, err.Error())
		return err
	}
	p.runningPid = cmd.Process.Pid
	log.Infof("Started %s at %d", p.Name, cmd.Process.Pid)
	err = cmd.Wait()
	p.runningPid = 0
	return err
}

type heartbeat struct {
	name string
	pid  int
}

func (w *Watchdog) heartbeatToLog(delay time.Duration) {
	// wait enough time for the first heartbeat so it's actually useful
	time.Sleep(1 * time.Minute)
	for {
		var heartbeats []heartbeat
		for _, p := range w.Programs {
			heartbeats = append(heartbeats, heartbeat{p.Name, p.runningPid})
		}
		w.Log.Infof("heartbeating programs: %v", heartbeats)
		select {
		case <-w.shutdownCh:
			w.Log.Infof("watchdog is shutting down, stop heartbeating")
			return
		case <-time.After(delay):
			continue
		}
	}
}

// watchProgram will monitor a program and restart it if it exits.
// This method will run forever.
func (w *Watchdog) startProgram(idx int) {
	program := &(w.Programs[idx])
	for {
		start := time.Now()
		err := program.Run(w.Log, w.shutdownCh)
		if err != nil {
			w.Log.Errorf("Error running %s: %+v; %s", program.Name, program, err)
		} else {
			w.Log.Infof("%s finished: %+v", program.Name, program)
			if program.ExitOn == ExitOnSuccess {
				w.Log.Infof("Program %s configured to exit on success, not restarting", program.Name)
				break
			} else if program.ExitOn == ExitAllOnSuccess {
				w.Log.Infof("Program %s configured to trigger full watchdog shutdown", program.Name)
				w.Shutdown()
			}
		}
		w.Log.Infof("Program %s ran for %s", program.Name, time.Since(start))
		select {
		case <-w.shutdownCh:
			w.Log.Infof("watchdog is shutting down, not restarting %s", program.Name)
			return
		default:
		}
		if time.Since(start) < w.RestartDelay {
			w.Log.Infof("Waiting %s before trying to start %s command again", w.RestartDelay, program.Name)
			time.Sleep(w.RestartDelay)
		}
	}
}

// terminateExistingMatches aggressively kills anything running that looks like similar
// to what this watchdog will be running. the goal here is to be sure that, if multiple
// calls attempt to start a watchdog, the last one will be the only one that survives.
func (w *Watchdog) terminateExistingMatches() {
	w.Log.Infof("Terminate any existing programs that look like matches")
	var killedPids []int
	for i := 1; i <= 3; i++ {
		killedPids = w.killSimilarRunningPrograms()
		if !includesARealProcess(killedPids) {
			w.Log.Infof("none of these programs are running")
			return
		}
		w.Log.Infof("Terminated pids %v", killedPids)
		time.Sleep(terminationDelay)
	}
}

func includesARealProcess(pids []int) bool {
	for _, p := range pids {
		if p > 0 {
			return true
		}
	}
	return false
}

func (w *Watchdog) killSimilarRunningPrograms() (killedPids []int) {
	// kill any running processes that look like the ones this watchdog wants to watch
	// this logic also exists in the updater, so if you want to change it, look there too.
	ospid := os.Getpid()
	for _, program := range w.Programs {
		matcher := process.NewMatcher(program.Path, process.PathEqual, w.Log)
		matcher.ExceptPID(ospid)
		w.Log.Infof("Terminating %s", program.Name)
		pids := process.TerminateAll(matcher, time.Second, w.Log)
		killedPids = append(killedPids, pids...)
	}
	return killedPids
}
