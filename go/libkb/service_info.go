// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"time"
)

// ServiceInfo describes runtime info for a service.
// This is primarily used to detect service updates.
type ServiceInfo struct {
	Version string `json:"version,omitempty"`
	Label   string `json:"label,omitempty"`
	Pid     int    `json:"pid,omitempty"`
}

// KeybaseServiceInfo is runtime info for the Keybase service.
func KeybaseServiceInfo(g *GlobalContext) ServiceInfo {
	return ServiceInfo{
		Version: VersionString(),
		Label:   g.Env.GetLabel(),
		Pid:     os.Getpid(),
	}
}

// NewServiceInfo generates service info for other services (like KBFS).
func NewServiceInfo(version string, prerelease string, label string, pid int) ServiceInfo {
	if prerelease != "" {
		version = fmt.Sprintf("%s-%s", version, prerelease)
	}
	return ServiceInfo{
		Version: version,
		Label:   label,
		Pid:     pid,
	}
}

// WriteFile writes service info as JSON in runtimeDir.
func (s ServiceInfo) WriteFile(path string) error {
	out, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, []byte(out), 0644)
}

// serviceLog is the log interface for ServiceInfo
type serviceLog interface {
	Debug(s string, args ...interface{})
}

// WaitForServiceInfoFile tries to wait for a service info file, which should be
// written on successful service startup.
func WaitForServiceInfoFile(path string, label string, pid string, maxAttempts int, wait time.Duration, log serviceLog) (*ServiceInfo, error) {
	if pid == "" {
		return nil, fmt.Errorf("No pid to wait for")
	}

	lookForServiceInfo := func() (*ServiceInfo, error) {
		if _, ferr := os.Stat(path); os.IsNotExist(ferr) {
			return nil, nil
		}
		dat, err := ioutil.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var serviceInfo ServiceInfo
		err = json.Unmarshal(dat, &serviceInfo)
		if err != nil {
			return nil, err
		}

		// Make sure the info file is the pid we are waiting for, otherwise it is
		// still starting up.
		if pid != fmt.Sprintf("%d", serviceInfo.Pid) {
			return nil, nil
		}

		// PIDs match, the service has started up
		return &serviceInfo, nil
	}

	attempt := 1
	serviceInfo, lookErr := lookForServiceInfo()
	for attempt < maxAttempts && serviceInfo == nil {
		attempt++
		log.Debug("Waiting for service info file (%s)...", path)
		time.Sleep(wait)
		serviceInfo, lookErr = lookForServiceInfo()
	}

	// If no service info was found, let's return an error
	if serviceInfo == nil {
		if lookErr == nil {
			lookErr = fmt.Errorf("%s isn't running (expecting pid=%s)", label, pid)
		}
		return nil, lookErr
	}

	// We succeeded in finding service info
	log.Debug("Found service info: %#v", *serviceInfo)
	return serviceInfo, nil
}
