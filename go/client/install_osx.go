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
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ServiceLabel string

const (
	BrewServiceLabel ServiceLabel = "homebrew.mxcl.keybase"
	BrewKBFSLabel    ServiceLabel = "homebrew.mxcl.kbfs"
	AppServiceLabel  ServiceLabel = "keybase.service"
	AppKBFSLabel     ServiceLabel = "keybase.kbfs"
)

func keybaseServiceStatus(g *libkb.GlobalContext, label string, bundleVersion string) keybase1.ServiceStatus {
	if label == "" {
		label = defaultServiceLabel(g.Env.GetRunMode())
	}
	kbService := launchd.NewService(label)

	st, done := serviceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))
	st.BundleVersion = bundleVersion
	if done {
		return st
	}

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
		label = defaultKBFSLabel(g.Env.GetRunMode())
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

func listServices() (*keybase1.ServicesStatus, error) {
	services, err := launchd.ListServices([]string{"keybase.service", "homebrew.mxcl.keybase"})
	if err != nil {
		return nil, err
	}
	kbfs, err := launchd.ListServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"})
	if err != nil {
		return nil, err
	}

	return &keybase1.ServicesStatus{
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

func defaultServiceLabel(runMode libkb.RunMode) string {
	if libkb.IsBrewBuild {
		return BrewServiceLabel.labelForRunMode(runMode)
	}
	return AppServiceLabel.labelForRunMode(runMode)
}

func defaultKBFSLabel(runMode libkb.RunMode) string {
	if libkb.IsBrewBuild {
		return BrewKBFSLabel.labelForRunMode(runMode)
	}
	return AppKBFSLabel.labelForRunMode(runMode)
}

func serviceInfoPath(g *libkb.GlobalContext) string {
	return path.Join(g.Env.GetRuntimeDir(), "keybased.info")
}

func installKeybaseService(g *libkb.GlobalContext, binPath string) (*keybase1.ServiceStatus, error) {
	label := defaultServiceLabel(g.Env.GetRunMode())
	plistArgs := []string{"service"}
	envVars := defaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
	err := launchd.Install(plist, os.Stdout)
	if err != nil {
		return nil, err
	}

	kbService := launchd.NewService(label)
	st, _ := serviceStatusFromLaunchd(kbService, serviceInfoPath(g))

	return &st, nil
}

// Uninstall keybase all services for this run mode.
func uninstallKeybaseServices(runMode libkb.RunMode) {
	launchd.Uninstall(AppServiceLabel.labelForRunMode(runMode), os.Stdout)
	launchd.Uninstall(BrewServiceLabel.labelForRunMode(runMode), os.Stdout)
}

func installKBFSService(g *libkb.GlobalContext, binPath string) (*keybase1.ServiceStatus, error) {
	runMode := g.Env.GetRunMode()
	label := defaultKBFSLabel(runMode)
	kbfsBinPath, err := kbfsBinPath(runMode, binPath)
	if err != nil {
		return nil, err
	}
	mountPath := kbfsMountPath(g.Env.GetHome(), runMode)

	// Create mount dir if it doesn't exist
	if _, err := os.Stat(mountPath); os.IsNotExist(err) {
		// TODO Make dir hidden so it only shows when mounted?
		err := os.MkdirAll(mountPath, libkb.PermDir)
		if err != nil {
			return nil, err
		}
	}

	plistArgs := []string{mountPath}
	envVars := defaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars)
	err = launchd.Install(plist, os.Stdout)
	if err != nil {
		return nil, err
	}

	kbfsService := launchd.NewService(label)
	st, _ := serviceStatusFromLaunchd(kbfsService, "")

	return &st, nil
}

func uninstallKBFSServices(runMode libkb.RunMode) {
	launchd.Uninstall(AppKBFSLabel.labelForRunMode(runMode), os.Stdout)
	launchd.Uninstall(BrewKBFSLabel.labelForRunMode(runMode), os.Stdout)
}

// Lookup the default service label for this build.
func (l ServiceLabel) labelForRunMode(runMode libkb.RunMode) string {
	switch runMode {
	case libkb.DevelRunMode:
		return fmt.Sprintf("%s.devel", l)
	case libkb.StagingRunMode:
		return fmt.Sprintf("%s.staging", l)
	case libkb.ProductionRunMode:
		return string(l)
	default:
		panic("Invalid run mode")
	}
}

func Install(g *libkb.GlobalContext, binPath string, components []string, force bool) []keybase1.InstallComponent {
	var err error
	status := []keybase1.InstallComponent{}

	g.Log.Debug("Installing components: %s", components)

	if libkb.IsIn("cli", components, false) {
		g.Log.Debug("Checking command line")
		err = installCommandLine(g, binPath, true) // Always force CLI install
		if err != nil {
			status = append(status, keybase1.InstallComponent{Name: "cli", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.InstallComponent{Name: "cli", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("service", components, false) {
		err = installService(g, binPath, force)
		if err != nil {
			status = append(status, keybase1.InstallComponent{Name: "service", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.InstallComponent{Name: "service", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("kbfs", components, false) {
		err = installKBFS(g, binPath, force)
		if err != nil {
			status = append(status, keybase1.InstallComponent{Name: "kbfs", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.InstallComponent{Name: "kbfs", Status: keybase1.Status{Name: "OK"}})
		}
	}

	return status
}

func installCommandLine(g *libkb.GlobalContext, binPath string, force bool) error {
	bp, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	linkPath := filepath.Join("/usr/local/bin", binName())
	g.Log.Info("Checking %s (%s)", linkPath, bp)
	err = installCommandLineForBinPath(bp, linkPath, force)
	if err != nil {
		g.Log.Errorf("Command line not installed properly (%s)", err)
		return err
	}

	return nil
}

func installCommandLineForBinPath(binPath string, linkPath string, force bool) error {
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

func installService(g *libkb.GlobalContext, binPath string, force bool) error {
	bp, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	g.Log.Debug("Using binPath: %s", bp)
	g.Log.Info("Checking service")
	keybaseStatus := keybaseServiceStatus(g, "", "")
	g.Log.Info("Service: %s", keybaseStatus.InstallStatus.String())
	if keybaseStatus.NeedsInstall() || force {
		g.Log.Info("Installing Keybase service")
		uninstallKeybaseServices(g.Env.GetRunMode())
		_, err := installKeybaseService(g, bp)
		if err != nil {
			g.Log.Errorf("Error installing Keybase service: %s", err)
			return err
		}
	}

	return nil
}

func installKBFS(g *libkb.GlobalContext, binPath string, force bool) error {
	bp, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	g.Log.Info("Checking KBFS")
	kbfsStatus := kbfsServiceStatus(g, "", "")
	g.Log.Info("KBFS: %s", kbfsStatus.InstallStatus.String())
	if kbfsStatus.NeedsInstall() || force {
		g.Log.Info("Installing KBFS")
		uninstallKBFSServices(g.Env.GetRunMode())
		_, err := installKBFSService(g, bp)
		if err != nil {
			g.Log.Errorf("Error installing KBFS: %s", err)
			return err
		}
	}

	return nil
}

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return binPath()
}

func binPath() (string, error) {
	if libkb.IsBrewBuild {
		// Use the brew opt bin directory.
		binName := filepath.Base(os.Args[0])
		return filepath.Join("/usr/local/opt", binName, "bin", binName), nil
	}

	path := os.Args[0]
	if !strings.HasPrefix(path, "/") {
		return path, fmt.Errorf("We need to be run with an absolute path to this executable to determine its full path.")
	}

	return path, nil
}

func binName() string {
	return filepath.Base(os.Args[0])
}

func kbfsBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	path, err := chooseBinPath(binPath)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), kbfsBinName(runMode)), nil
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
		return filepath.Join(homeDir, "Keybase.stage")

	case libkb.ProductionRunMode:
		return filepath.Join(homeDir, "Keybase")

	default:
		panic("Invalid run mode")
	}
}

func AutoInstallWithStatus(g *libkb.GlobalContext, binPath string, force bool) []keybase1.InstallComponent {
	status := []keybase1.InstallComponent{}
	_, err := AutoInstall(g, binPath, force)
	if err != nil {
		status = append(status, keybase1.InstallComponent{Name: "service", Status: errorStatus("INSTALL_ERROR", err.Error())})
	} else {
		status = append(status, keybase1.InstallComponent{Name: "service", Status: keybase1.Status{Name: "OK"}})
	}
	return status
}

func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	g.Log.Debug("+ AutoInstall for launchd")
	defer func() {
		g.Log.Debug("- AutoInstall -> %v, %v", newProc, err)
	}()
	label := defaultServiceLabel(g.Env.GetRunMode())
	if label == "" {
		err = fmt.Errorf("No service label to install")
		return newProc, err
	}

	// Check if plist is installed. If so we're already installed and return.
	plistPath := launchd.PlistDestination(label)
	if _, err := os.Stat(plistPath); err == nil {
		g.Log.Debug("| already installed at %s", plistPath)
		if !force {
			return newProc, nil
		}
	}

	err = installService(g, binPath, true)
	if err != nil {
		return newProc, err
	}

	newProc = true
	return newProc, nil
}
