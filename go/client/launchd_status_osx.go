// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"
	"path"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func KeybaseServiceStatus(g *libkb.GlobalContext, bundleVersion string) keybase1.ServiceStatus {
	serviceLabel := libkb.DefaultServiceLabel(libkb.KeybaseServiceID, libkb.DefaultRunMode)
	kbService := launchd.NewService(serviceLabel)
	kbLaunchdStatus, err := kbService.Status()
	if err != nil {
		return errorStatus(err)
	}

	st := keybase1.ServiceStatus{
		BundleVersion: bundleVersion,
		Label:         serviceLabel,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	if kbLaunchdStatus == nil {
		st.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		st.InstallAction = keybase1.InstallAction_INSTALL
	} else {
		st.Label = kbLaunchdStatus.Label()
		st.Pid = kbLaunchdStatus.Pid()
		st.LastExitStatus = kbLaunchdStatus.LastExitStatus()
	}

	var config keybase1.Config
	if st.Pid != "" {
		runtimeDir := g.Env.GetRuntimeDir()
		_, err := libkb.WaitForServiceInfoFile(path.Join(runtimeDir, "keybased.info"), st.Pid, 5, 500*time.Millisecond, "launchd status for service")
		if err != nil {
			return errorStatus(err)
		}

		configClient, err := GetConfigClient(g)
		if err != nil {
			return errorStatus(err)
		}

		config, err = configClient.GetConfig(context.TODO(), 0)
		if err != nil {
			return errorStatus(err)
		}

		if config.Label != kbLaunchdStatus.Label() {
			return errorStatus(fmt.Errorf("Service label mismatch: %s != %s", config.Label, kbLaunchdStatus.Label()))
		}
	}

	st.Version = config.Version

	// Something must be wrong if this build doesn't match the package version.
	buildVersion := libkb.VersionString()
	if bundleVersion != "" && bundleVersion != buildVersion {
		st.InstallAction = keybase1.InstallAction_NONE
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.Error = &keybase1.StatusError{Message: fmt.Sprintf("Version mismatch: %s != %s", bundleVersion, buildVersion)}
		return st
	}

	installStatus, installAction, se := installStatus(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Error = se
	return st
}

func KBFSServiceStatus(g *libkb.GlobalContext, bundleVersion string) keybase1.ServiceStatus {
	serviceLabel := libkb.DefaultServiceLabel(libkb.KBFSServiceID, libkb.DefaultRunMode)
	kbfsService := launchd.NewService(serviceLabel)
	kbfsLaunchdStatus, err := kbfsService.Status()
	if err != nil {
		return errorStatus(err)
	}

	st := keybase1.ServiceStatus{
		BundleVersion: bundleVersion,
		Label:         serviceLabel,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	var kbfsInfo *libkb.ServiceInfo
	if kbfsLaunchdStatus == nil {
		st.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		st.InstallAction = keybase1.InstallAction_INSTALL
		return st
	}

	st.Label = kbfsLaunchdStatus.Label()
	st.Pid = kbfsLaunchdStatus.Pid()
	st.LastExitStatus = kbfsLaunchdStatus.LastExitStatus()

	if kbfsLaunchdStatus.Pid() != "" {
		runtimeDir := g.Env.GetRuntimeDir()
		kbfsInfo, err = libkb.WaitForServiceInfoFile(path.Join(runtimeDir, "kbfs.info"), kbfsLaunchdStatus.Pid(), 5, 500*time.Millisecond, "launchd status for kbfs")
		if err != nil {
			return errorStatus(err)
		}
	}

	// nil means not running or file wasn't found
	if kbfsInfo == nil {
		kbfsInfo = &libkb.ServiceInfo{}
	}

	st.Version = kbfsInfo.Version

	installStatus, installAction, se := installStatus(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Error = se
	return st
}

func installStatus(version string, bundleVersion string, lastExitStatus string) (keybase1.InstallStatus, keybase1.InstallAction, *keybase1.StatusError) {
	installStatus := keybase1.InstallStatus_UNKNOWN
	installAction := keybase1.InstallAction_UNKNOWN
	if version != "" && bundleVersion != "" {
		sv, err := semver.Make(version)
		if err != nil {
			return keybase1.InstallStatus_ERROR,
				keybase1.InstallAction_REINSTALL,
				&keybase1.StatusError{Message: err.Error()}
		}
		bsv, err := semver.Make(bundleVersion)
		// Invalid bundle bersion
		if err != nil {
			return keybase1.InstallStatus_ERROR,
				keybase1.InstallAction_NONE,
				&keybase1.StatusError{Message: err.Error()}
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
				&keybase1.StatusError{Message: fmt.Sprintf("Bundle version (%s) is less than installed version (%s)", bundleVersion, version)}
		}
	} else if version != "" && bundleVersion == "" {
		installStatus = keybase1.InstallStatus_INSTALLED
	}

	// If we have an unknown install status, then let's try to re-install.
	if bundleVersion != "" && installStatus == keybase1.InstallStatus_UNKNOWN && (version != "" || lastExitStatus != "") {
		installAction = keybase1.InstallAction_REINSTALL
		installStatus = keybase1.InstallStatus_INSTALLED
	}

	return installStatus, installAction, nil
}

func errorStatus(err error) keybase1.ServiceStatus {
	return keybase1.ServiceStatus{
		InstallStatus: keybase1.InstallStatus_ERROR,
		Error: &keybase1.StatusError{
			Message: err.Error(),
		},
	}
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
		status, err := service.Status()
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
