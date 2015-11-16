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

// NewServiceInfo for generating service info for other services (like KBFS).
func NewServiceInfo(version string, build string, label string, pid int) ServiceInfo {
	return ServiceInfo{
		Version: fmt.Sprintf("%s-%s", version, build),
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

// WaitForServiceInfoFile tries to wait for a service info file, which should be
// written on successful service startup.
func WaitForServiceInfoFile(path string, pid string, maxAttempts int, wait time.Duration, reason string) (*ServiceInfo, error) {
	if pid == "" {
		return nil, fmt.Errorf("No pid to wait for")
	}

	f := func() (*ServiceInfo, bool, error) {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return nil, true, nil
		}
		dat, err := ioutil.ReadFile(path)
		if err != nil {
			return nil, true, err
		}
		var serviceInfo ServiceInfo
		err = json.Unmarshal(dat, &serviceInfo)
		if err != nil {
			return nil, false, err
		}

		// Make sure the info file is the pid we are waiting for, otherwise it is
		// still starting up.
		serviceInfoPid := fmt.Sprintf("%d", serviceInfo.Pid)
		if serviceInfoPid != pid {
			return nil, true, fmt.Errorf("Service info pid mismatch: %s != %s", serviceInfoPid, pid)
		}

		return &serviceInfo, false, nil
	}

	attempt := 1
	serviceInfo, retry, err := f()
	for attempt < maxAttempts && retry {
		attempt++
		time.Sleep(wait)
		serviceInfo, retry, err = f()
	}

	return serviceInfo, err
}
