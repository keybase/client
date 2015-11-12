// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

const (
	keybaseServiceID = "keybase"
	kbfsServiceID    = "kbfs"
)

func keybaseServiceStatus(g *libkb.GlobalContext, label string, bundleVersion string) keybase1.ServiceStatus {
	if label == "" {
		label = defaultServiceLabel(keybaseServiceID, g.Env.GetRunMode(), libkb.IsBrewBuild)
	}
	kbService := launchd.NewService(label)

	st, done := serviceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))
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

func kbfsServiceStatus(g *libkb.GlobalContext, label string, bundleVersion string) keybase1.ServiceStatus {
	if label == "" {
		label = defaultServiceLabel(kbfsServiceID, g.Env.GetRunMode(), libkb.IsBrewBuild)
	}
	kbfsService := launchd.NewService(label)

	st, done := serviceStatusFromLaunchd(kbfsService, path.Join(g.Env.GetRuntimeDir(), "kbfs.info"))
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

func serviceStatusFromLaunchd(ls launchd.Service, infoPath string) (keybase1.ServiceStatus, bool) {
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
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Pid, 5, 500*time.Millisecond, "service status")
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

func serviceStatusesFromLaunchd(ls []launchd.Service) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, done := serviceStatusFromLaunchd(l, "")
		if !done {
			s.Status = keybase1.Status{Name: "OK"}
		}
		c = append(c, s)
	}
	return c
}

func listServices() (*ServicesStatus, error) {
	services, err := launchd.ListServices([]string{"keybase.service", "homebrew.mxcl.keybase"})
	if err != nil {
		return nil, err
	}
	kbfs, err := launchd.ListServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"})
	if err != nil {
		return nil, err
	}

	return &ServicesStatus{
		Service: serviceStatusesFromLaunchd(services),
		Kbfs:    serviceStatusesFromLaunchd(kbfs)}, nil
}

func showServices(out io.Writer) error {
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

func defaultLaunchdEnvVars(g *libkb.GlobalContext, label string) map[string]string {
	envVars := make(map[string]string)
	envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"
	envVars["KEYBASE_LABEL"] = label
	envVars["KEYBASE_LOG_FORMAT"] = "file"
	envVars["KEYBASE_RUNTIME_DIR"] = g.Env.GetRuntimeDir()
	return envVars
}

func installKeybaseService(g *libkb.GlobalContext) error {
	label := defaultServiceLabel(keybaseServiceID, g.Env.GetRunMode(), libkb.IsBrewBuild)
	binPath, err := binPath()
	if err != nil {
		return err
	}
	plistArgs := []string{"service"}
	envVars := defaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
	return launchd.Install(plist, os.Stdout)
}

func uninstallKeybaseServices(runMode libkb.RunMode) {
	launchd.Uninstall(defaultServiceLabel(keybaseServiceID, runMode, true), os.Stdout)
	launchd.Uninstall(defaultServiceLabel(keybaseServiceID, runMode, false), os.Stdout)
}

func installKBFSService(g *libkb.GlobalContext) error {
	runMode := g.Env.GetRunMode()
	label := defaultServiceLabel(kbfsServiceID, runMode, libkb.IsBrewBuild)
	kbfsBinPath, err := kbfsBinPath(runMode)
	if err != nil {
		return err
	}
	mountPath := kbfsMountPath(g.Env.GetHome(), runMode)
	plistArgs := []string{mountPath}
	envVars := defaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars)
	return launchd.Install(plist, os.Stdout)
}

func uninstallKBFSServices(runMode libkb.RunMode) {
	launchd.Uninstall(defaultServiceLabel(kbfsServiceID, runMode, true), os.Stdout)
	launchd.Uninstall(defaultServiceLabel(kbfsServiceID, runMode, false), os.Stdout)
}

// Lookup the default service label for this build.
func defaultServiceLabel(id string, runMode libkb.RunMode, isBrewBuild bool) string {
	if isBrewBuild {
		var name string
		switch id {
		case keybaseServiceID:
			name = "homebrew.mxcl.keybase"
		case kbfsServiceID:
			name = "homebrew.mxcl.kbfs"
		default:
			panic("Invalid service id")
		}
		switch runMode {
		case libkb.DevelRunMode:
			return fmt.Sprintf("%s.devel", name)
		case libkb.StagingRunMode:
			return fmt.Sprintf("%s.staging", name)
		case libkb.ProductionRunMode:
			return name
		default:
			panic("Invalid run mode")
		}
	} else {
		var name string
		switch id {
		case keybaseServiceID:
			name = "keybase.service"
		case kbfsServiceID:
			name = "keybase.kbfs"
		default:
			panic("Invalid service id")
		}
		switch runMode {
		case libkb.DevelRunMode:
			return fmt.Sprintf("%s.devel", name)
		case libkb.StagingRunMode:
			return fmt.Sprintf("%s.staging", name)
		case libkb.ProductionRunMode:
			return name
		default:
			panic("Invalid run mode")
		}
	}
}

type InstallStatus struct {
	Name   string          `json:"name"`
	Status keybase1.Status `json:"status"`
}

func install(g *libkb.GlobalContext, force bool) []InstallStatus {
	var err error
	status := []InstallStatus{}

	err = installCommandLine(g, true) // Always force CLI install
	if err != nil {
		status = append(status, InstallStatus{Name: "cli", Status: errorStatus("INSTALL_ERROR", err.Error())})
	} else {
		status = append(status, InstallStatus{Name: "cli", Status: keybase1.Status{Name: "OK"}})
	}

	err = installService(g, force)
	if err != nil {
		status = append(status, InstallStatus{Name: "service", Status: errorStatus("INSTALL_ERROR", err.Error())})
	} else {
		status = append(status, InstallStatus{Name: "service", Status: keybase1.Status{Name: "OK"}})
	}

	err = installKBFS(g, force)
	if err != nil {
		status = append(status, InstallStatus{Name: "kbfs", Status: errorStatus("INSTALL_ERROR", err.Error())})
	} else {
		status = append(status, InstallStatus{Name: "kbfs", Status: keybase1.Status{Name: "OK"}})
	}

	return status
}

func installCommandLine(g *libkb.GlobalContext, force bool) error {
	linkPath := filepath.Join("/usr/local/bin", binName(g.Env.GetRunMode()))
	binPath, err := binPath()
	if err != nil {
		return err
	}
	g.Log.Info("Checking %s (%s)", linkPath, binPath)
	err = installCommandLineForBin(binPath, linkPath, force)
	if err != nil {
		g.Log.Errorf("Command line not installed properly (%s)", err)
		return err
	}

	return nil
}

func installCommandLineForBin(binPath string, linkPath string, force bool) error {
	fi, err := os.Lstat(linkPath)
	if os.IsNotExist(err) {
		// Doesn't exist, create
		return createCommandLine(binPath, linkPath)
	}
	isLink := (fi.Mode()&os.ModeSymlink != 0)
	if !isLink {
		return fmt.Errorf("Path is not a symlink: %s", linkPath)
	}

	// Check that the symlink evals to this binPath or error
	dest, err := filepath.EvalSymlinks(linkPath)
	if err == nil && binPath != dest {
		err = fmt.Errorf("We are not symlinked to %s", linkPath)
	}
	if err != nil {
		if force {
			return createCommandLine(binPath, linkPath)
		}
		return fmt.Errorf("We are not symlinked to %s", linkPath)
	}

	return nil
}

func createCommandLine(binPath string, linkPath string) error {
	if _, err := os.Lstat(linkPath); err == nil {
		err := os.Remove(linkPath)
		if err != nil {
			return err
		}
	}

	return os.Symlink(binPath, linkPath)
}

func installService(g *libkb.GlobalContext, force bool) error {
	g.Log.Info("Checking service")
	keybaseStatus := keybaseServiceStatus(g, "", "")
	g.Log.Info("Service: %s", keybaseStatus.InstallStatus.ToString())
	if keybaseStatus.NeedsInstall() || force {
		g.Log.Info("Installing Keybase service")
		uninstallKeybaseServices(g.Env.GetRunMode())
		err := installKeybaseService(g)
		if err != nil {
			g.Log.Errorf("Error installing Keybase service: %s", err)
			return err
		}
	}

	return nil
}

func installKBFS(g *libkb.GlobalContext, force bool) error {
	g.Log.Info("Checking KBFS")
	kbfsStatus := kbfsServiceStatus(g, "", "")
	g.Log.Info("KBFS: %s", kbfsStatus.InstallStatus.ToString())
	if kbfsStatus.NeedsInstall() || force {
		g.Log.Info("Installing KBFS")
		uninstallKBFSServices(g.Env.GetRunMode())
		err := installKBFSService(g)
		if err != nil {
			g.Log.Errorf("Error installing KBFS: %s", err)
			return err
		}
	}

	return nil
}

func binPath() (string, error) {
	return filepath.Abs(os.Args[0])
}

func binName(runMode libkb.RunMode) string {
	switch runMode {
	case libkb.DevelRunMode:
		return "kbdev"

	case libkb.StagingRunMode:
		return "kbstage"

	case libkb.ProductionRunMode:
		return "keybase"

	default:
		panic("Invalid run mode")
	}
}

func kbfsBinPath(runMode libkb.RunMode) (string, error) {
	dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, kbfsBinName(runMode)), nil
}

func kbfsBinName(runMode libkb.RunMode) string {
	switch runMode {
	case libkb.DevelRunMode:
		return "kbfsdev"

	case libkb.StagingRunMode:
		return "kbfsstage"

	case libkb.ProductionRunMode:
		return "kbfs"

	default:
		panic("Invalid run mode")
	}
}

func kbfsMountPath(homeDir string, runMode libkb.RunMode) string {
	switch runMode {
	case libkb.DevelRunMode:
		return filepath.Join(homeDir, "Keybase.devel")

	case libkb.StagingRunMode:
		return filepath.Join(homeDir, "Keybase.staging")

	case libkb.ProductionRunMode:
		return filepath.Join(homeDir, "Keybase")

	default:
		panic("Invalid run mode")
	}
}
