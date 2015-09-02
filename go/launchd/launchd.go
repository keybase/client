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

	"github.com/keybase/client/go/libkb"
)

var log = libkb.G.Log

// Service defines a service
type Service struct {
	label string
}

// NewService constructs a launchd service.
func NewService(label string) Service {
	return Service{
		label: label,
	}
}

// Label for service
func (s Service) Label() string { return s.label }

// Plist defines a launchd plist
type Plist struct {
	label   string
	binPath string
	args    []string
}

// NewPlist constructs a launchd service.
func NewPlist(label string, binPath string, args []string) Plist {
	return Plist{
		label:   label,
		binPath: binPath,
		args:    args,
	}
}

// Load will load the service.
// If restart=true, then we'll unload it first.
func (s Service) Load(restart bool) error {
	// Unload first if we're forcing
	plistDest := s.plistDestination()
	if restart {
		exec.Command("/bin/launchctl", "unload", plistDest).Output()
	}
	log.Info("Loading %s", s.label)
	_, err := exec.Command("/bin/launchctl", "load", "-w", plistDest).Output()
	return err
}

// Unload will unload the service
func (s Service) Unload() error {
	plistDest := s.plistDestination()
	log.Info("Unloading %s", s.label)
	_, err := exec.Command("/bin/launchctl", "unload", plistDest).Output()
	return err
}

// Install will install the launchd service
func (s Service) Install(p Plist) (err error) {
	if _, err := os.Stat(p.binPath); os.IsNotExist(err) {
		return err
	}
	plist := p.plist()
	plistDest := s.plistDestination()

	log.Info("Saving %s", plistDest)
	file := libkb.NewFile(plistDest, []byte(plist), 0644)
	err = file.Save()
	if err != nil {
		return
	}

	err = s.Load(true)
	return
}

// Uninstall will uninstall the launchd service
func (s Service) Uninstall() (err error) {
	err = s.Unload()
	if err != nil {
		return
	}

	plistDest := s.plistDestination()
	if _, err := os.Stat(plistDest); err == nil {
		log.Info("Removing %s", plistDest)
		err = os.Remove(plistDest)
	}
	return
}

// ListServices will return service with label containing the filter string.
func ListServices(filter string) ([]Service, error) {
	files, err := ioutil.ReadDir(launchAgentDir())
	if err != nil {
		return nil, err
	}
	var services []Service
	for _, f := range files {
		name := f.Name()
		suffix := ".plist"
		// We care about services that contain the filter word and end in .plist
		if strings.Contains(name, filter) && strings.HasSuffix(name, suffix) {
			label := name[0 : len(name)-len(suffix)]
			service := NewService(label)
			services = append(services, service)
		}
	}
	return services, nil
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

// StatusDescription returns the service status description
func (s Service) StatusDescription() string {
	status, err := s.Status()
	if err != nil {
		return fmt.Sprintf("%s: %v", s.label, err)
	}
	return fmt.Sprintf("%s: %s", s.label, status.Description())
}

// Status returns service status
func (s Service) Status() (*ServiceStatus, error) {
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

// ShowServices ouputs keybase service info
func ShowServices(filter string) (err error) {
	services, err := ListServices(filter)
	if err != nil {
		return
	}
	if len(services) > 0 {
		log.Info("Found %s:", libkb.Pluralize(len(services), "service", "services"))
		for _, service := range services {
			log.Info(service.StatusDescription())
		}
	} else {
		log.Info("No services")
	}
	return
}

// Install will install a service
func Install(plist Plist) (err error) {
	service := NewService(plist.label)
	return service.Install(plist)
}

// Uninstall will uninstall a keybase service
func Uninstall(label string) error {
	service := NewService(label)
	return service.Uninstall()
}

// Start will start a keybase service
func Start(label string) error {
	service := NewService(label)
	return service.Load(false)
}

// Stop will stop a keybase service
func Stop(label string) error {
	service := NewService(label)
	return service.Unload()
}

// ShowStatus shows status info for a service
func ShowStatus(label string) error {
	service := NewService(label)
	status, err := service.Status()
	if err != nil {
		return err
	}
	log.Info(status.Description())
	return nil
}

// Restart restarts a service
func Restart(label string) error {
	service := NewService(label)
	return service.Load(true)
}

func launchAgentDir() string {
	return filepath.Join(launchdHomeDir(), "Library", "LaunchAgents")
}

func (s Service) plistDestination() string {
	return filepath.Join(launchAgentDir(), s.label+".plist")
}

func launchdHomeDir() string {
	currentUser, err := user.Current()
	if err != nil {
		panic(err)
	}
	return currentUser.HomeDir
}

func launchdLogDir() string {
	return filepath.Join(launchdHomeDir(), "Library", "Logs")
}

// TODO Use go-plist library
func (p Plist) plist() string {
	logFile := filepath.Join(launchdLogDir(), p.label+".log")

	encodeString := func(s string) string {
		return fmt.Sprintf("<string>%s</string>", s)
	}

	pargs := []string{}
	pargs = append(pargs, encodeString(p.binPath))
	for _, arg := range p.args {
		pargs = append(pargs, encodeString(arg))
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>` + p.label + `</string>
  <key>ProgramArguments</key>
  <array>` + "\n    " + strings.Join(pargs, "\n    ") + `
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>` + logFile + `</string>
  <key>StandardOutPath</key>
  <string>` + logFile + `</string>
</dict>
</plist>`
}
