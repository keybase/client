// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package command

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

// Log is the logging interface for the command package
type Log interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// Program is a program at path with arguments
type Program struct {
	Path string
	Args []string
}

// ArgsWith returns program args with passed in args
func (p Program) ArgsWith(args []string) []string {
	if p.Args == nil || len(p.Args) == 0 {
		return args
	}
	if len(args) == 0 {
		return p.Args
	}
	return append(p.Args, args...)
}

// Result is the result of running a command
type Result struct {
	Stdout  bytes.Buffer
	Stderr  bytes.Buffer
	Process *os.Process
}

// CombinedOutput returns Stdout and Stderr as a single string.
func (r Result) CombinedOutput() string {
	strs := []string{}
	if sout := r.Stdout.String(); sout != "" {
		strs = append(strs, fmt.Sprintf("[stdout]: %s", sout))
	}
	if serr := r.Stderr.String(); serr != "" {
		strs = append(strs, fmt.Sprintf("[stderr]: %s", serr))
	}
	return strings.Join(strs, ", ")
}

type execCmd func(name string, arg ...string) *exec.Cmd

// Exec runs a command and returns the stdout/err output and error if any
func Exec(name string, args []string, timeout time.Duration, log Log) (Result, error) {
	return execWithFunc(name, args, nil, exec.Command, timeout, log)
}

// ExecWithEnv runs a command with an environment and returns the stdout/err output and error if any
func ExecWithEnv(name string, args []string, env []string, timeout time.Duration, log Log) (Result, error) {
	return execWithFunc(name, args, env, exec.Command, timeout, log)
}

// exec runs a command and returns a Result and error if any.
// We will send TERM signal and wait 1 second or timeout, whichever is less,
// before calling KILL.
func execWithFunc(name string, args []string, env []string, execCmd execCmd, timeout time.Duration, log Log) (Result, error) {
	var result Result
	log.Debugf("Execute: %s %s", name, args)
	if name == "" {
		return result, fmt.Errorf("No command")
	}
	if timeout < 0 {
		return result, fmt.Errorf("Invalid timeout: %s", timeout)
	}
	cmd := execCmd(name, args...)
	if cmd == nil {
		return result, fmt.Errorf("No command")
	}
	cmd.Stdout = &result.Stdout
	cmd.Stderr = &result.Stderr
	if env != nil {
		cmd.Env = env
	}
	err := cmd.Start()
	if err != nil {
		return result, err
	}
	result.Process = cmd.Process
	doneCh := make(chan error)
	go func() {
		doneCh <- cmd.Wait()
		close(doneCh)
	}()
	// Wait for the command to finish or time out
	select {
	case cmdErr := <-doneCh:
		log.Debugf("Executed %s %s", name, args)
		return result, cmdErr
	case <-time.After(timeout):
		// Timed out
		log.Warningf("Process timed out")
	}
	// If no process, nothing to kill
	if cmd.Process == nil {
		return result, fmt.Errorf("No process")
	}

	// Signal the process to terminate gracefully
	// Wait a second or timeout for termination, whichever less
	termWait := time.Second
	if timeout < termWait {
		termWait = timeout
	}
	log.Warningf("Command timed out, terminating (will wait %s before killing)", termWait)
	err = cmd.Process.Signal(syscall.SIGTERM)
	if err != nil {
		log.Warningf("Error sending terminate: %s", err)
	}
	select {
	case <-doneCh:
		log.Warningf("Terminated")
	case <-time.After(termWait):
		// Bring out the big guns
		log.Warningf("Command failed to terminate, killing")
		if err := cmd.Process.Kill(); err != nil {
			log.Warningf("Error trying to kill process: %s", err)
		} else {
			log.Warningf("Killed process")
		}
	}
	return result, fmt.Errorf("Timed out")
}

// ExecForJSON runs a command (with timeout) expecting JSON output with obj interface
func ExecForJSON(command string, args []string, obj interface{}, timeout time.Duration, log Log) error {
	result, err := execWithFunc(command, args, nil, exec.Command, timeout, log)
	if err != nil {
		return err
	}
	if err := json.NewDecoder(&result.Stdout).Decode(&obj); err != nil {
		return fmt.Errorf("Error in result: %s", err)
	}
	return nil
}
