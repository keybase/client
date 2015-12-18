// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/mounter"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ServiceLabel string

const (
	BrewServiceLabel ServiceLabel = "homebrew.mxcl.keybase"
	BrewKBFSLabel    ServiceLabel = "homebrew.mxcl.kbfs"
	AppServiceLabel  ServiceLabel = "keybase.service"
	AppKBFSLabel     ServiceLabel = "keybase.kbfs"
)

func KeybaseServiceStatus(g *libkb.GlobalContext, label string) keybase1.ServiceStatus {
	if label == "" {
		label = defaultServiceLabel(g.Env.GetRunMode())
	}
	kbService := launchd.NewService(label)

	st, done := serviceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))
	st.BundleVersion = libkb.VersionString()
	if done {
		return st
	}

	installStatus, installAction, status := Status(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status
	return st
}

func KBFSServiceStatus(g *libkb.GlobalContext, label string) keybase1.ServiceStatus {
	if label == "" {
		label = defaultKBFSLabel(g.Env.GetRunMode())
	}
	kbfsService := launchd.NewService(label)

	st, done := serviceStatusFromLaunchd(kbfsService, path.Join(g.Env.GetRuntimeDir(), "kbfs.info"))
	bundleVersion, err := kbfsBundleVersion(g, "")
	if err != nil {
		st.Status = errorStatus("STATUS_ERROR", err.Error())
		return st
	}
	st.BundleVersion = bundleVersion
	if done {
		return st
	}

	installStatus, installAction, status := Status(st.Version, st.BundleVersion, st.LastExitStatus)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status
	return st
}

func errorStatus(name string, desc string) keybase1.Status {
	return keybase1.Status{Code: libkb.SCGeneric, Name: name, Desc: desc}
}

func Status(version string, bundleVersion string, lastExitStatus string) (keybase1.InstallStatus, keybase1.InstallAction, keybase1.Status) {
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
			installStatus = keybase1.InstallStatus_INSTALLED
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

func ListServices() (*keybase1.ServicesStatus, error) {
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

func ShowServices(out io.Writer) error {
	err := launchd.ShowServices([]string{"keybase.service.", "homebrew.mxcl.keybase"}, "Keybase", out)
	if err != nil {
		return err
	}
	err = launchd.ShowServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"}, "KBFS", out)
	if err != nil {
		return err
	}
	return nil
}

func DefaultLaunchdEnvVars(g *libkb.GlobalContext, label string) map[string]string {
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
	envVars := DefaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
	err := launchd.Install(plist, ioutil.Discard)
	if err != nil {
		return nil, err
	}

	kbService := launchd.NewService(label)
	st, _ := serviceStatusFromLaunchd(kbService, serviceInfoPath(g))

	return &st, nil
}

// Uninstall keybase all services for this run mode.
func uninstallKeybaseServices(runMode libkb.RunMode) error {
	err1 := launchd.Uninstall(AppServiceLabel.labelForRunMode(runMode), ioutil.Discard)
	err2 := launchd.Uninstall(BrewServiceLabel.labelForRunMode(runMode), ioutil.Discard)
	return libkb.CombineErrors(err1, err2)
}

func kbfsBundleVersion(g *libkb.GlobalContext, binPath string) (string, error) {
	runMode := g.Env.GetRunMode()
	kbfsBinPath, err := kbfsBinPath(runMode, binPath)
	if err != nil {
		return "", err
	}

	kbfsVersionOutput, err := exec.Command(kbfsBinPath, "--version").Output()
	if err != nil {
		return "", err
	}
	kbfsVersion := strings.TrimSpace(string(kbfsVersionOutput))
	return kbfsVersion, nil
}

func installKBFSService(g *libkb.GlobalContext, binPath string) (*keybase1.ServiceStatus, error) {
	runMode := g.Env.GetRunMode()
	label := defaultKBFSLabel(runMode)
	kbfsBinPath, err := kbfsBinPath(runMode, binPath)
	if err != nil {
		return nil, err
	}

	mountPath := kbfsMountPath(runMode)
	_, err = os.Stat(mountPath)
	if err != nil {
		return nil, err
	}

	plistArgs := []string{mountPath}
	envVars := DefaultLaunchdEnvVars(g, label)

	plist := launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars)
	err = launchd.Install(plist, ioutil.Discard)
	if err != nil {
		return nil, err
	}

	kbfsService := launchd.NewService(label)
	st, _ := serviceStatusFromLaunchd(kbfsService, "")

	return &st, nil
}

func uninstallKBFSServices(runMode libkb.RunMode) error {
	err1 := launchd.Uninstall(AppKBFSLabel.labelForRunMode(runMode), ioutil.Discard)
	err2 := launchd.Uninstall(BrewKBFSLabel.labelForRunMode(runMode), ioutil.Discard)
	return libkb.CombineErrors(err1, err2)
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

func Install(g *libkb.GlobalContext, binPath string, components []string, force bool) []keybase1.ComponentStatus {
	var err error
	status := []keybase1.ComponentStatus{}

	g.Log.Debug("Installing components: %s", components)

	if libkb.IsIn("cli", components, false) {
		g.Log.Debug("Checking command line")
		err = installCommandLine(g, binPath, true) // Always force CLI install
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "cli", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "cli", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("service", components, false) {
		err = installService(g, binPath, force)
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "service", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "service", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("kbfs", components, false) {
		err = installKBFS(g, binPath, force)
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "kbfs", Status: errorStatus("INSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "kbfs", Status: keybase1.Status{Name: "OK"}})
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
	if linkPath == bp {
		return fmt.Errorf("We can't symlink to ourselves: %s", bp)
	}
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
	keybaseStatus := KeybaseServiceStatus(g, "")
	g.Log.Info("Service: %s (Action: %s)", keybaseStatus.InstallStatus.String(), keybaseStatus.InstallAction.String())
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
	kbfsStatus := KBFSServiceStatus(g, "")
	g.Log.Info("KBFS: %s (Action: %s)", kbfsStatus.InstallStatus.String(), kbfsStatus.InstallAction.String())
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

func Uninstall(g *libkb.GlobalContext, components []string) []keybase1.ComponentStatus {
	var err error
	status := []keybase1.ComponentStatus{}

	g.Log.Debug("Uninstalling components: %s", components)

	if libkb.IsIn("cli", components, false) {
		g.Log.Debug("Checking command line")
		err = uninstallCommandLine(g)
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "cli", Status: errorStatus("UNINSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "cli", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("kbfs", components, false) {
		err = uninstallKBFS(g)
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "kbfs", Status: errorStatus("UNINSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "kbfs", Status: keybase1.Status{Name: "OK"}})
		}
	}

	if libkb.IsIn("service", components, false) {
		err = uninstallService(g)
		if err != nil {
			status = append(status, keybase1.ComponentStatus{Name: "service", Status: errorStatus("UNINSTALL_ERROR", err.Error())})
		} else {
			status = append(status, keybase1.ComponentStatus{Name: "service", Status: keybase1.Status{Name: "OK"}})
		}
	}

	return status
}

func uninstallCommandLine(g *libkb.GlobalContext) error {
	linkPath := filepath.Join("/usr/local/bin", binName())

	fi, err := os.Lstat(linkPath)
	if os.IsNotExist(err) {
		return nil
	}
	isLink := (fi.Mode()&os.ModeSymlink != 0)
	if !isLink {
		return fmt.Errorf("Path is not a symlink: %s", linkPath)
	}
	return os.Remove(linkPath)
}

func uninstallService(g *libkb.GlobalContext) error {
	return uninstallKeybaseServices(g.Env.GetRunMode())
}

func uninstallKBFS(g *libkb.GlobalContext) error {
	err := uninstallKBFSServices(g.Env.GetRunMode())
	if err != nil {
		return err
	}

	mountPath := kbfsMountPath(g.Env.GetRunMode())
	if _, err := os.Stat(mountPath); os.IsNotExist(err) {
		return nil
	}
	mounted, err := mounter.IsMounted(g, mountPath)
	if err != nil {
		return err
	}
	if mounted {
		err = mounter.Unmount(g, mountPath, false)
		if err != nil {
			return err
		}
	}
	empty, err := libkb.IsDirEmpty(mountPath)
	if err != nil {
		return err
	}
	if !empty {
		return fmt.Errorf("Mount has files after unmounting: %s", mountPath)
	}
	return trashDir(g, mountPath)
}

// We're only moving the folder in case something somehow managed to get at it
// in between unmounting and checking if it had files.
func trashDir(g *libkb.GlobalContext, dir string) error {
	randString, err := libkb.RandString("Trash.", 20)
	if err != nil {
		return err
	}
	return os.Rename(dir, filepath.Join(g.Env.GetCacheDir(), randString))
}

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return binPath()
}

func brewPath(formula string) (string, error) {
	// Get the homebrew install path prefix for this formula
	prefixOutput, err := exec.Command("brew", "--prefix", formula).Output()
	if err != nil {
		return "", err
	}
	prefix := strings.TrimSpace(string(prefixOutput))
	return prefix, nil
}

func binPath() (string, error) {
	if libkb.IsBrewBuild {
		binName := binName()
		prefix, err := brewPath(binName)
		if err != nil {
			return "", err
		}
		return filepath.Join(prefix, "bin", binName), nil
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
	// If it's brew lookup path by formula name
	kbfsBinName := kbfsBinName(runMode)
	if libkb.IsBrewBuild {
		prefix, err := brewPath(kbfsBinName)
		if err != nil {
			return "", err
		}
		return filepath.Join(prefix, "bin", kbfsBinName), nil
	}

	// Use the same directory as the binPath
	path, err := chooseBinPath(binPath)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), kbfsBinName), nil
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

func kbfsMountPath(runMode libkb.RunMode) string {
	switch runMode {
	case libkb.DevelRunMode:
		return "/keybase.devel"

	case libkb.StagingRunMode:
		return "/keybase.staging"

	case libkb.ProductionRunMode:
		return "/keybase"

	default:
		panic("Invalid run mode")
	}
}

func AutoInstallWithStatus(g *libkb.GlobalContext, binPath string, force bool) []keybase1.ComponentStatus {
	status := []keybase1.ComponentStatus{}
	_, err := AutoInstall(g, binPath, force)
	if err != nil {
		status = append(status, keybase1.ComponentStatus{Name: "service", Status: errorStatus("INSTALL_ERROR", err.Error())})
	} else {
		status = append(status, keybase1.ComponentStatus{Name: "service", Status: keybase1.Status{Name: "OK"}})
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
