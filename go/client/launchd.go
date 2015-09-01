// +build darwin

package client

import (
	"bufio"
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/keybase/client/go/libkb"
)

// Service defines a service
type Service struct {
	homeDir string
	label   string
}

// NewService constructs a launchd service.
func NewService(homeDir string, label string) Service {
	return Service{
		homeDir: homeDir,
		label:   label,
	}
}

// Load will load the service
func (s Service) Load(force bool) error {
	G.Log.Info("Loading %s", s.label)
	// Unload first if we're forcing
	plistDest := s.plistDestination()
	if force {
		exec.Command("/bin/launchctl", "unload", plistDest).Output()
	}
	_, err := exec.Command("/bin/launchctl", "load", "-w", plistDest).Output()
	return err
}

// Unload will unload the service
func (s Service) Unload() error {
	plistDest := s.plistDestination()
	G.Log.Info("Unloading %s", s.label)
	_, err := exec.Command("/bin/launchctl", "unload", plistDest).Output()
	return err
}

// Install will install the launchd service
func (s Service) Install(binPath string, logDir string) (err error) {
	if _, err := os.Stat(binPath); os.IsNotExist(err) {
		return err
	}
	plist := s.plist(binPath, logDir)
	plistDest := s.plistDestination()

	G.Log.Info("Saving %s", plistDest)
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
		G.Log.Info("Removing %s", plistDest)
		err = os.Remove(plistDest)
	}
	return
}

// ListServices will return keybase services.
func ListServices(homeDir string) ([]Service, error) {
	files, err := ioutil.ReadDir(launchAgentDir(homeDir))
	if err != nil {
		return nil, err
	}
	var services []Service
	for _, f := range files {
		name := f.Name()
		suffix := ".plist"
		// We care about services that contain the word "keybase"
		if strings.Contains(name, "keybase") && strings.HasSuffix(name, suffix) {
			label := name[0 : len(name)-len(suffix)]
			service := NewService(homeDir, label)
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

// Description returns service status info
func (s ServiceStatus) Description() string {
	var status string
	infos := []string{}
	if s.pid != "" {
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

// Status returns service status
func (s Service) Status() (status ServiceStatus, err error) {
	out, err := exec.Command("/bin/launchctl", "list").Output()
	if err != nil {
		return
	}

	scanner := bufio.NewScanner(bytes.NewBuffer(out))
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) == 3 && fields[2] == s.label {
			if fields[0] != "-" {
				status.pid = fields[0]
			}
			if fields[1] != "-" {
				status.lastExitStatus = fields[1]
			}
			status.label = fields[2]
			break
		}
	}

	// If pid is set and > 0, then clear lastExitStatus which is the
	// exit status of the previous run and doesn't mean anything for
	// the current state. Clearing it to avoid confusion.
	pid, _ := strconv.ParseInt(status.pid, 0, 64)
	if status.pid != "" && pid > 0 {
		status.lastExitStatus = ""
	}

	return
}

// ShowServices ouputs keybase service info
func ShowServices(homeDir string) (err error) {
	services, err := ListServices(homeDir)
	if err != nil {
		return
	}
	if len(services) > 0 {
		G.Log.Info("Found %s:", libkb.Pluralize(len(services), "service", "services"))
		for _, service := range services {
			status, err := service.Status()
			if err != nil {
				G.Log.Info("%s: %v", service.label, err)
			} else {
				G.Log.Info("%s: %s", service.label, status.Description())
			}
		}
	} else {
		G.Log.Info("No services")
	}
	return
}

// Install will install a keybase service
func Install(homeDir string, label string, installBin string, logDir string) (err error) {
	service := NewService(homeDir, label)
	err = service.Install(installBin, logDir)
	return
}

// Uninstall will uninstall a keybase service
func Uninstall(homeDir string, label string) error {
	service := NewService(homeDir, label)
	return service.Uninstall()
}

// ShowStatus shows status info for a service
func ShowStatus(homeDir string, label string) error {
	service := NewService(homeDir, label)
	status, err := service.Status()
	if err != nil {
		return err
	}
	G.Log.Info(status.Description())
	return nil
}

func launchAgentDir(homeDir string) string {
	return filepath.Join(homeDir, "Library", "LaunchAgents")
}

func (s Service) plistDestination() string {
	return filepath.Join(launchAgentDir(s.homeDir), s.label+".plist")
}

func (s Service) plist(binPath string, logDir string) string {
	logFile := filepath.Join(logDir, s.label+".G.Log")

	return `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
    <plist version="1.0">
    <dict>
      <key>Label</key>
      <string>` + s.label + `</string>
      <key>ProgramArguments</key>
      <array>
        <string>` + binPath + `</string>
        <string>--G.Log-format=file</string>
        <string>service</string>
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
