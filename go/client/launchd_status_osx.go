// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"
	"io"
	"path"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func KeybaseServiceStatus(g *libkb.GlobalContext, label string, bundleVersion string) keybase1.ServiceStatus {
	if label == "" {
		label = libkb.DefaultServiceLabel(libkb.KeybaseServiceID, libkb.DefaultRunMode)
	}
	kbService := launchd.NewService(label)

	st, done := ServiceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))
	st.BundleVersion = bundleVersion
	if done {
		return st
	}

	/*
		var config keybase1.Config
		if st.Pid != "" {
			configClient, err := GetConfigClient(g)
			if err != nil {
				st.Status = errorStatus("INSTALL_ERROR", err.Error())
				return st
			}

			config, err = configClient.GetConfig(context.TODO(), 0)
			if err != nil {
				st.Status = errorStatus("INSTALL_ERROR", err.Error())
				return st
			}

			if config.Label != st.Label {
				st.Status = errorStatus("INSTALL_ERROR", fmt.Sprintf("Service label mismatch: %s != %s", config.Label, st.Label))
				return st
			}

			st.Version = config.Version
		}
	*/

	// Something must be wrong if this build doesn't match the package version.
	buildVersion := libkb.VersionString()
	if bundleVersion != "" && bundleVersion != buildVersion {
		st.InstallAction = keybase1.InstallAction_NONE
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.Status = errorStatus("INSTALL_ERROR", fmt.Sprintf("Version mismatch: %s != %s", bundleVersion, buildVersion))
		return st
	}

	installStatus, installAction, status := installStatus(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status
	return st
}

func KBFSServiceStatus(g *libkb.GlobalContext, label string, bundleVersion string) keybase1.ServiceStatus {
	if label == "" {
		label = libkb.DefaultServiceLabel(libkb.KBFSServiceID, libkb.DefaultRunMode)
	}
	kbfsService := launchd.NewService(label)

	st, done := ServiceStatusFromLaunchd(kbfsService, path.Join(g.Env.GetRuntimeDir(), "kbfs.info"))
	st.BundleVersion = bundleVersion
	if done {
		return st
	}

	installStatus, installAction, status := installStatus(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status
	return st
}

func errorStatus(name string, desc string) keybase1.Status {
	return keybase1.Status{Code: libkb.SCGeneric, Name: name, Desc: desc}
}

func installStatus(version string, bundleVersion string, lastExitStatus string) (keybase1.InstallStatus, keybase1.InstallAction, keybase1.Status) {
	installStatus := keybase1.InstallStatus_UNKNOWN
	installAction := keybase1.InstallAction_UNKNOWN
	if version != "" && bundleVersion != "" {
		sv, err := semver.Make(version)
		if err != nil {
			return keybase1.InstallStatus_ERROR,
				keybase1.InstallAction_REINSTALL,
				errorStatus("INSTALL_ERROR", err.Error())
		}
		bsv, err := semver.Make(bundleVersion)
		// Invalid bundle bersion
		if err != nil {
			return keybase1.InstallStatus_ERROR,
				keybase1.InstallAction_NONE,
				errorStatus("INSTALL_ERROR", err.Error())
		}
		if bsv.GT(sv) {
			installStatus = keybase1.InstallStatus_NEEDS_UPGRADE
			installAction = keybase1.InstallAction_UPGRADE
		} else if bsv.EQ(sv) {
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_NONE
		} else if bsv.LT(sv) {
			return keybase1.InstallStatus_ERROR,
				keybase1.InstallAction_NONE,
				errorStatus("INSTALL_ERROR", fmt.Sprintf("Bundle version (%s) is less than installed version (%s)", bundleVersion, version))
		}
	} else if version != "" && bundleVersion == "" {
		installStatus = keybase1.InstallStatus_INSTALLED
	} else if version == "" && bundleVersion != "" {
		installStatus = keybase1.InstallStatus_NOT_INSTALLED
		installAction = keybase1.InstallAction_INSTALL
	}

	// If we have an unknown install status, then let's try to re-install.
	if bundleVersion != "" && installStatus == keybase1.InstallStatus_UNKNOWN && (version != "" || lastExitStatus != "") {
		installAction = keybase1.InstallAction_REINSTALL
		installStatus = keybase1.InstallStatus_INSTALLED
	}

	return installStatus, installAction, keybase1.Status{Name: "OK"}
}

type ServicesStatus struct {
	Service []keybase1.ServiceStatus `json:"service"`
	Kbfs    []keybase1.ServiceStatus `json:"kbfs"`
}

func ServiceStatusFromLaunchd(ls launchd.Service, infoPath string) (keybase1.ServiceStatus, bool) {
	status := keybase1.ServiceStatus{
		Label: ls.Label(),
	}

	st, err := ls.LoadStatus()
	if err != nil {
		status.Status = errorStatus("LAUNCHD_ERROR", err.Error())
		return status, true
	}

	if st == nil {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
		status.Status = keybase1.Status{Name: "OK"}
		return status, true
	}

	status.Label = st.Label()
	status.Pid = st.Pid()
	status.LastExitStatus = st.LastExitStatus()

	// Check service info file (if present) and if the service is running (has a PID)
	var serviceInfo *libkb.ServiceInfo
	if infoPath != "" {
		if status.Pid != "" {
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Pid, 20, 200*time.Millisecond, "service status")
			if err != nil {
				status.InstallStatus = keybase1.InstallStatus_ERROR
				status.InstallAction = keybase1.InstallAction_REINSTALL
				status.Status = errorStatus("LAUNCHD_ERROR", err.Error())
				return status, true
			}
		}
		if serviceInfo != nil {
			status.Version = serviceInfo.Version
		}
	}

	if status.Pid == "" {
		status.InstallStatus = keybase1.InstallStatus_ERROR
		status.InstallAction = keybase1.InstallAction_REINSTALL
		status.Status = errorStatus("LAUNCHD_ERROR", fmt.Sprintf("%s is not running", st.Label()))
		return status, true
	}

	return status, false
}

func ServiceStatusesFromLaunchd(ls []launchd.Service) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, done := ServiceStatusFromLaunchd(l, "")
		if !done {
			s.Status = keybase1.Status{Name: "OK"}
		}
		c = append(c, s)
	}
	return c
}

// ListServicesInFormat returns keybase service info in a specified format.
func ListServices() (*ServicesStatus, error) {
	services, err := launchd.ListServices([]string{"keybase.service", "homebrew.mxcl.keybase"})
	if err != nil {
		return nil, err
	}
	kbfs, err := launchd.ListServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"})
	if err != nil {
		return nil, err
	}

	return &ServicesStatus{
		Service: ServiceStatusesFromLaunchd(services),
		Kbfs:    ServiceStatusesFromLaunchd(kbfs)}, nil
}

// ShowServices outputs service info to writer.
func ShowServices(out io.Writer) error {
	err := launchd.ShowServices([]string{"keybase.service", "homebrew.mxcl.keybase"}, "Keybase", out)
	if err != nil {
		return err
	}
	err = launchd.ShowServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"}, "KBFS", out)
	if err != nil {
		return err
	}
	return nil
}

func DiagnoseSocketError(ui libkb.UI, err error) {
	t := ui.GetTerminalUI()
	services, err := launchd.ListServices([]string{"keybase."})
	if err != nil {
		t.Printf("Error checking launchd services: %v\n\n", err)
		return
	}

	if len(services) == 0 {
		t.Printf("\nThere are no Keybase services installed. You may need to re-install.\n")
	} else if len(services) > 1 {
		t.Printf("\nWe found multiple services:\n")
		for _, service := range services {
			t.Printf("  " + service.StatusDescription() + "\n")
		}
		t.Printf("\n")
	} else if len(services) == 1 {
		service := services[0]
		status, err := service.LoadStatus()
		if err != nil {
			t.Printf("Error checking service status(%s): %v\n\n", service.Label(), err)
		} else {
			if status == nil || !status.IsRunning() {
				t.Printf("\nWe found a Keybase service (%s) but it's not running.\n", service.Label())
				cmd := fmt.Sprintf("keybase launchd start %s", service.Label())
				t.Printf("You might try starting it: " + cmd + "\n\n")
			} else {
				t.Printf("\nWe couldn't connect but there is a Keybase service (%s) running (%s).\n\n", status.Label(), status.Pid())
				cmd := fmt.Sprintf("keybase launchd restart %s", service.Label())
				t.Printf("You might try restarting it: " + cmd + "\n\n")
			}
		}
	}
}
