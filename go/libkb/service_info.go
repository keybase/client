// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"time"

	"github.com/keybase/client/go/logger"
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
func (s ServiceInfo) WriteFile(path string, log logger.Logger) error {
	out, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}

	file := NewFile(path, []byte(out), 0644)
	return file.Save(log)
}

// serviceLog is the log interface for ServiceInfo
type serviceLog interface {
	Debug(s string, args ...interface{})
}

// WaitForServiceInfoFile tries to wait for a service info file, which should be
// written on successful service startup.
func WaitForServiceInfoFile(path string, label string, pid string, timeout time.Duration, log serviceLog) (*ServiceInfo, error) {
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

	log.Debug("Looking for service info file (timeout=%s)", timeout)
	serviceInfo, err := waitForServiceInfo(timeout, time.Millisecond*400, lookForServiceInfo)

	// If no service info was found, let's return an error
	if serviceInfo == nil {
		if err == nil {
			err = fmt.Errorf("%s isn't running (expecting pid=%s)", label, pid)
		}
		return nil, err
	}

	// We succeeded in finding service info
	log.Debug("Found service info: %#v", *serviceInfo)
	return serviceInfo, nil
}

type serviceInfoResult struct {
	info *ServiceInfo
	err  error
}

type loadServiceInfoFn func() (*ServiceInfo, error)

func waitForServiceInfo(timeout time.Duration, delay time.Duration, fn loadServiceInfoFn) (*ServiceInfo, error) {
	if timeout <= 0 {
		return fn()
	}

	ticker := time.NewTicker(delay)
	defer ticker.Stop()
	resultChan := make(chan serviceInfoResult, 1)
	go func() {
		for {
			select {
			case <-ticker.C:
				info, err := fn()
				if err != nil {
					resultChan <- serviceInfoResult{info: nil, err: err}
					return
				}
				if info != nil {
					resultChan <- serviceInfoResult{info: info, err: nil}
					return
				}
			}
		}
	}()

	select {
	case res := <-resultChan:
		return res.info, res.err
	case <-time.After(timeout):
		return nil, nil
	}
}
