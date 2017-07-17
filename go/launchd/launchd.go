// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package launchd

import (
	"bufio"
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/keybase/client/go/libkb"
)

// Service defines a service
type Service struct {
	label string
	log   Log
}

// NewService constructs a launchd service.
func NewService(label string) Service {
	return Service{
		label: label,
		log:   emptyLog{},
	}
}

// SetLogger sets the logger
func (s *Service) SetLogger(log Log) {
	if log != nil {
		s.log = log
	} else {
		s.log = emptyLog{}
	}
}

// Label for service
func (s Service) Label() string { return s.label }

// EnvVar defines and environment variable for the Plist
type EnvVar struct {
	key   string
	value string
}

// NewEnvVar creates a new environment variable
func NewEnvVar(key string, value string) EnvVar {
	return EnvVar{key, value}
}

// Plist defines a launchd plist
type Plist struct {
	label     string
	binPath   string
	args      []string
	envVars   []EnvVar
	keepAlive bool
	runAtLoad bool
	logPath   string
	comment   string
}

// NewPlist constructs a launchd service plist
func NewPlist(label string, binPath string, args []string, envVars []EnvVar, logPath string, comment string) Plist {
	return Plist{
		label:     label,
		binPath:   binPath,
		args:      args,
		envVars:   envVars,
		keepAlive: true,
		runAtLoad: false,
		logPath:   logPath,
		comment:   comment,
	}
}

// Start will start the service.
func (s Service) Start(wait time.Duration) error {
	if !s.HasPlist() {
		return fmt.Errorf("No service (plist) installed with label: %s", s.label)
	}

	plistDest := s.plistDestination()
	s.log.Info("Starting %s", s.label)
	// We start using load -w on plist file
	output, err := exec.Command("/bin/launchctl", "load", "-w", plistDest).CombinedOutput()
	s.log.Debug("Output (launchctl load): %s", string(output))
	if err != nil {
		return err
	}

	if wait > 0 {
		status, waitErr := s.WaitForStatus(wait, 500*time.Millisecond)
		if waitErr != nil {
			return waitErr
		}
		if status == nil {
			return fmt.Errorf("%s is not running", s.label)
		}
		s.log.Debug("Service status: %#v", status)
	}

	return nil
}

// HasPlist returns true if service has plist installed
func (s Service) HasPlist() bool {
	plistDest := s.plistDestination()
	if _, err := os.Stat(plistDest); err == nil {
		return true
	}
	return false
}

func exitStatus(err error) int {
	if exitErr, ok := err.(*exec.ExitError); ok {
		if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
			return status.ExitStatus()
		}
	}
	return 0
}

// Stop a service.
// Returns true, nil on successful stop.
// If false, nil is returned it means there was nothing to stop.
func (s Service) Stop(wait time.Duration) (bool, error) {
	// We stop by removing the job. This works for non-demand and demand jobs.
	output, err := exec.Command("/bin/launchctl", "remove", s.label).CombinedOutput()
	s.log.Debug("Output (launchctl remove): %s", string(output))
	if err != nil {
		exitStatus := exitStatus(err)
		// Exit status 3 on remove means there was no job to remove
		if exitStatus == 3 {
			s.log.Debug("Nothing to stop (%s)", s.label)
			return false, nil
		}
		return false, fmt.Errorf("Error removing via launchctl: %s", err)
	}
	if wait > 0 {
		// The docs say launchd ExitTimeOut defaults to 20 seconds, but in practice
		// it seems more like 5 seconds before it resorts to a SIGKILL.
		// Because of the SIGKILL fallback we can use a large timeout here of 25
		// seconds, which we'll likely never reach unless the process is zombied.
		if waitErr := s.WaitForExit(wait); waitErr != nil {
			return false, waitErr
		}
	}
	s.log.Info("Stopped %s", s.label)
	return true, nil
}

// Restart a service.
func (s Service) Restart(wait time.Duration) error {
	return Restart(s.Label(), wait, s.log)
}

type serviceStatusResult struct {
	status *ServiceStatus
	err    error
}

// WaitForStatus waits for service status to be available
func (s Service) WaitForStatus(wait time.Duration, delay time.Duration) (*ServiceStatus, error) {
	s.log.Info("Waiting for %s to be loaded...", s.label)
	return waitForStatus(wait, delay, s.LoadStatus)
}

type loadStatusFn func() (*ServiceStatus, error)

func waitForStatus(wait time.Duration, delay time.Duration, fn loadStatusFn) (*ServiceStatus, error) {
	if wait <= 0 {
		return fn()
	}

	ticker := time.NewTicker(delay)
	defer ticker.Stop()
	resultChan := make(chan serviceStatusResult, 1)
	go func() {
		for {
			select {
			case <-ticker.C:
				status, err := fn()
				if err != nil {
					resultChan <- serviceStatusResult{status: nil, err: err}
					return
				}
				if status != nil && status.HasRun() {
					resultChan <- serviceStatusResult{status: status, err: nil}
					return
				}
			}
		}
	}()

	select {
	case res := <-resultChan:
		return res.status, res.err
	case <-time.After(wait):
		return nil, nil
	}
}

// WaitForExit waits for service to exit
func (s Service) WaitForExit(wait time.Duration) error {
	s.log.Info("Waiting for %s to exit...", s.label)
	return waitForExit(wait, 200*time.Millisecond, s.LoadStatus)
}

func waitForExit(wait time.Duration, delay time.Duration, fn loadStatusFn) error {
	ticker := time.NewTicker(delay)
	defer ticker.Stop()
	errChan := make(chan error, 1)
	go func() {
		for {
			select {
			case <-ticker.C:
				status, err := fn()
				if err != nil {
					errChan <- err
					return
				}
				if status == nil || !status.IsRunning() {
					errChan <- nil
					return
				}
			}
		}
	}()

	select {
	case err := <-errChan:
		return err
	case <-time.After(wait):
		return fmt.Errorf("Waiting for service exit timed out")
	}
}

// Install will install the launchd service
func (s Service) Install(p Plist, wait time.Duration) error {
	return s.install(p, wait)
}

func (s Service) savePlist(p Plist) error {
	plistDest := s.plistDestination()

	if _, ferr := os.Stat(p.binPath); os.IsNotExist(ferr) {
		return fmt.Errorf("%s doesn't exist", p.binPath)
	}

	plist := p.plistXML()

	// Plist directory (~/Library/LaunchAgents/) might not exist on clean OS installs
	// See GH issue: https://github.com/keybase/client/pull/1399#issuecomment-164810645
	if err := libkb.MakeParentDirs(plistDest); err != nil {
		return err
	}

	s.log.Info("Saving %s", plistDest)
	file := libkb.NewFile(plistDest, []byte(plist), 0644)
	if err := file.Save(s.log); err != nil {
		return err
	}

	return nil
}

func (s Service) install(p Plist, wait time.Duration) error {
	if err := s.savePlist(p); err != nil {
		return err
	}
	return s.Start(wait)
}

// Uninstall will uninstall the launchd service
func (s Service) Uninstall(wait time.Duration) error {
	errs := []error{}
	// It's safer to remove the plist before stopping in case stopping
	// hangs the system somehow, the plist will still be removed.
	plistDest := s.plistDestination()
	if _, err := os.Stat(plistDest); err == nil {
		s.log.Info("Removing %s", plistDest)
		if err := os.Remove(plistDest); err != nil {
			errs = append(errs, err)
		}
	}

	if _, err := s.Stop(wait); err != nil {
		errs = append(errs, err)
	}

	return libkb.CombineErrors(errs...)
}

// ListServices will return service with label that starts with a filter string.
func ListServices(filters []string) (services []Service, err error) {
	launchAgentDir := launchAgentDir()
	if _, derr := os.Stat(launchAgentDir); os.IsNotExist(derr) {
		return
	}
	files, err := ioutil.ReadDir(launchAgentDir)
	if err != nil {
		return
	}
	for _, f := range files {
		fileName := f.Name()
		suffix := ".plist"
		// We care about services that contain the filter word and end in .plist
		for _, filter := range filters {
			if strings.HasPrefix(fileName, filter) && strings.HasSuffix(fileName, suffix) {
				label := fileName[0 : len(fileName)-len(suffix)]
				service := NewService(label)
				services = append(services, service)
			}
		}
	}
	return
}

// ServiceStatus defines status for a service
type ServiceStatus struct {
	label          string
	pid            string // May be blank if not set, or a number "123"
	lastExitStatus string // Will be blank if pid > 0, or a number "123"
}

// Label for status
func (s ServiceStatus) Label() string { return s.label }

// Pid for status (empty string if not running)
func (s ServiceStatus) Pid() string { return s.pid }

// LastExitStatus will be blank if pid > 0, or a number "123"
func (s ServiceStatus) LastExitStatus() string { return s.lastExitStatus }

// HasRun returns true if service is running, or has run and failed
func (s ServiceStatus) HasRun() bool {
	return s.Pid() != "" || s.LastExitStatus() != "0"
}

// Description returns service status info
func (s ServiceStatus) Description() string {
	var status string
	infos := []string{}
	if s.IsRunning() {
		status = "Running"
		infos = append(infos, fmt.Sprintf("(pid=%s)", s.pid))
	} else {
		status = "Not Running"
	}
	if s.lastExitStatus != "" {
		infos = append(infos, fmt.Sprintf("exit=%s", s.lastExitStatus))
	}
	return status + " " + strings.Join(infos, ", ")
}

// IsRunning is true if the service is running (with a pid)
func (s ServiceStatus) IsRunning() bool {
	return s.pid != ""
}

// IsErrored is true if the service errored trying to start
func (s ServiceStatus) IsErrored() bool {
	return s.lastExitStatus != ""
}

// StatusDescription returns the service status description
func (s Service) StatusDescription() string {
	status, err := s.LoadStatus()
	if status == nil {
		return fmt.Sprintf("%s: Not Running", s.label)
	}
	if err != nil {
		return fmt.Sprintf("%s: %v", s.label, err)
	}
	return fmt.Sprintf("%s: %s", s.label, status.Description())
}

// LoadStatus returns service status
func (s Service) LoadStatus() (*ServiceStatus, error) {
	out, err := exec.Command("/bin/launchctl", "list").Output()
	if err != nil {
		return nil, err
	}

	var pid, lastExitStatus string
	var found bool
	scanner := bufio.NewScanner(bytes.NewBuffer(out))
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) == 3 && fields[2] == s.label {
			found = true
			if fields[0] != "-" {
				pid = fields[0]
			}
			if fields[1] != "-" {
				lastExitStatus = fields[1]
			}
		}
	}

	if found {
		// If pid is set and > 0, then clear lastExitStatus which is the
		// exit status of the previous run and doesn't mean anything for
		// the current state. Clearing it to avoid confusion.
		pidInt, _ := strconv.ParseInt(pid, 0, 64)
		if pid != "" && pidInt > 0 {
			lastExitStatus = ""
		}
		return &ServiceStatus{label: s.label, pid: pid, lastExitStatus: lastExitStatus}, nil
	}

	return nil, nil
}

// CheckPlist returns false, if the plist destination doesn't match what we
// would install. This means the plist is old and we need to update it.
func (s Service) CheckPlist(plist Plist) (bool, error) {
	plistDest := s.plistDestination()
	return plist.Check(plistDest)
}

// Install will install a service
func Install(plist Plist, wait time.Duration, log Log) error {
	service := NewService(plist.label)
	service.SetLogger(log)
	return service.Install(plist, wait)
}

// Uninstall will uninstall a service
func Uninstall(label string, wait time.Duration, log Log) error {
	service := NewService(label)
	service.SetLogger(log)
	return service.Uninstall(wait)
}

// Start will start a service
func Start(label string, wait time.Duration, log Log) error {
	service := NewService(label)
	service.SetLogger(log)
	return service.Start(wait)
}

// Stop a service.
// Returns true, nil on successful stop.
// If false, nil is returned it means there was nothing to stop.
func Stop(label string, wait time.Duration, log Log) (bool, error) {
	service := NewService(label)
	service.SetLogger(log)
	return service.Stop(wait)
}

// ShowStatus shows status info for a service
func ShowStatus(label string, log Log) error {
	service := NewService(label)
	service.SetLogger(log)
	status, err := service.LoadStatus()
	if err != nil {
		return err
	}
	if status != nil {
		log.Info("%s", status.Description())
	} else {
		log.Info("No service found with label: %s", label)
	}
	return nil
}

// Restart restarts a service
func Restart(label string, wait time.Duration, log Log) error {
	service := NewService(label)
	service.SetLogger(log)
	if _, err := service.Stop(wait); err != nil {
		return err
	}
	return service.Start(wait)
}

func launchAgentDir() string {
	return filepath.Join(launchdHomeDir(), "Library", "LaunchAgents")
}

// PlistDestination is the plist path for a label
func PlistDestination(label string) string {
	return filepath.Join(launchAgentDir(), label+".plist")
}

// PlistDestination is the service plist path
func (s Service) PlistDestination() string {
	return s.plistDestination()
}

func (s Service) plistDestination() string {
	return PlistDestination(s.label)
}

func launchdHomeDir() string {
	currentUser, err := user.Current()
	if err != nil {
		panic(err)
	}
	return currentUser.HomeDir
}

func ensureDirectoryExists(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		err = os.MkdirAll(dir, 0700)
		return err
	}
	return nil
}

// Check if plist matches plist at path
func (p Plist) Check(path string) (bool, error) {
	if p.binPath == "" {
		return false, fmt.Errorf("Invalid ProgramArguments")
	}

	// If path doesn't exist, we don't match
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return false, nil
	}

	buf, err := ioutil.ReadFile(path)
	if err != nil {
		return false, err
	}

	plistXML := p.plistXML()
	if string(buf) == plistXML {
		return true, nil
	}

	return false, nil
}

// TODO Use go-plist library
func (p Plist) plistXML() string {
	encodeTag := func(name, val string) string {
		return fmt.Sprintf("<%s>%s</%s>", name, val, name)
	}

	encodeBool := func(val bool) string {
		sval := "false"
		if val {
			sval = "true"
		}
		return fmt.Sprintf("<%s/>", sval)
	}

	pargs := []string{}
	// First arg is the executable
	pargs = append(pargs, encodeTag("string", p.binPath))
	for _, arg := range p.args {
		pargs = append(pargs, encodeTag("string", arg))
	}

	envVars := []string{}
	for _, envVar := range p.envVars {
		envVars = append(envVars, encodeTag("key", envVar.key))
		envVars = append(envVars, encodeTag("string", envVar.value))
	}

	options := []string{}
	if p.keepAlive {
		options = append(options, encodeTag("key", "KeepAlive"), encodeBool(true))
	}
	if p.runAtLoad {
		options = append(options, encodeTag("key", "RunAtLoad"), encodeBool(true))
	}

	xml := `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>` + p.label + `</string>
  <key>EnvironmentVariables</key>
  <dict>` + "\n    " + strings.Join(envVars, "\n    ") + `
  </dict>
  <key>ProgramArguments</key>
  <array>` + "\n    " + strings.Join(pargs, "\n    ") + `
  </array>` +
		"\n  " + strings.Join(options, "\n  ") + `
  <key>StandardErrorPath</key>
  <string>` + p.logPath + `</string>
  <key>StandardOutPath</key>
  <string>` + p.logPath + `</string>
  <key>WorkingDirectory</key>
  <string>/tmp</string>
</dict>
</plist>
`

	if p.comment != "" {
		xml = fmt.Sprintf("<!-- %s -->\n%s", p.comment, xml)
	}

	return xml
}

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type emptyLog struct{}

func (l emptyLog) Debug(s string, args ...interface{})  {}
func (l emptyLog) Info(s string, args ...interface{})   {}
func (l emptyLog) Errorf(s string, args ...interface{}) {}
