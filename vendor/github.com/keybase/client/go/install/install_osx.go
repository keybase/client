// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"

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

func KeybaseServiceStatus(g *libkb.GlobalContext, label string) (status keybase1.ServiceStatus) {
	if label == "" {
		label = defaultServiceLabel(g.Env.GetRunMode())
	}
	kbService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))
	status.BundleVersion = libkb.VersionString()
	if err != nil {
		return
	}
	if status.InstallStatus == keybase1.InstallStatus_NOT_INSTALLED {
		return
	}

	installStatus, installAction, kbStatus := ResolveInstallStatus(status.Version, status.BundleVersion, status.LastExitStatus)
	status.InstallStatus = installStatus
	status.InstallAction = installAction
	status.Status = kbStatus
	return
}

func KBFSServiceStatus(g *libkb.GlobalContext, label string) (status keybase1.ServiceStatus) {
	if label == "" {
		label = defaultKBFSLabel(g.Env.GetRunMode())
	}
	kbfsService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbfsService, path.Join(g.Env.GetRuntimeDir(), "kbfs.info"))
	if err != nil {
		return
	}
	bundleVersion, err := kbfsBundleVersion(g, "")
	if err != nil {
		status.Status = errorStatus("STATUS_ERROR", err.Error())
		return
	}
	status.BundleVersion = bundleVersion
	if status.InstallStatus == keybase1.InstallStatus_NOT_INSTALLED {
		return
	}

	installStatus, installAction, kbStatus := ResolveInstallStatus(status.Version, status.BundleVersion, status.LastExitStatus)
	status.InstallStatus = installStatus
	status.InstallAction = installAction
	status.Status = kbStatus
	return
}

func serviceStatusFromLaunchd(ls launchd.Service, infoPath string) (status keybase1.ServiceStatus, err error) {
	status = keybase1.ServiceStatus{
		Label: ls.Label(),
	}

	launchdStatus, err := ls.LoadStatus()
	if err != nil {
		status.InstallStatus = keybase1.InstallStatus_ERROR
		status.InstallAction = keybase1.InstallAction_NONE
		status.Status = errorStatus("LAUNCHD_ERROR", err.Error())
		return
	}

	if launchdStatus == nil {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
		status.Status = keybase1.Status{Name: "OK"}
		return
	}

	status.Label = launchdStatus.Label()
	status.Pid = launchdStatus.Pid()
	status.LastExitStatus = launchdStatus.LastExitStatus()

	// Check service info file (if present) and if the service is running (has a PID)
	var serviceInfo *libkb.ServiceInfo
	if infoPath != "" {
		if status.Pid != "" {
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Pid, 20, 200*time.Millisecond, "service status")
			if err != nil {
				status.InstallStatus = keybase1.InstallStatus_ERROR
				status.InstallAction = keybase1.InstallAction_REINSTALL
				status.Status = errorStatus("LAUNCHD_ERROR", err.Error())
				return
			}
		}
		if serviceInfo != nil {
			status.Version = serviceInfo.Version
		}
	}

	if status.Pid == "" {
		status.InstallStatus = keybase1.InstallStatus_ERROR
		status.InstallAction = keybase1.InstallAction_REINSTALL
		err = fmt.Errorf("%s is not running", status.Label)
		status.Status = errorStatus("LAUNCHD_ERROR", err.Error())
		return
	}

	status.Status = keybase1.Status{Name: "OK"}
	return
}

func serviceStatusesFromLaunchd(ls []launchd.Service) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, _ := serviceStatusFromLaunchd(l, "")
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
	st, err := serviceStatusFromLaunchd(kbService, serviceInfoPath(g))
	return &st, err
}

// Uninstall keybase all services for this run mode.
func uninstallKeybaseServices(runMode libkb.RunMode) error {
	err1 := launchd.Uninstall(AppServiceLabel.labelForRunMode(runMode), ioutil.Discard)
	err2 := launchd.Uninstall(BrewServiceLabel.labelForRunMode(runMode), ioutil.Discard)
	return libkb.CombineErrors(err1, err2)
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
	st, err := serviceStatusFromLaunchd(kbfsService, "")
	return &st, err
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

func Install(g *libkb.GlobalContext, binPath string, components []string, force bool) keybase1.InstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	g.Log.Debug("Installing components: %s", components)

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = installCommandLine(g, binPath, true) // Always force CLI install
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = installService(g, binPath, force)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = installKBFS(g, binPath, force)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	return NewInstallResult(componentResults)
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
	g.Log.Debug("Checking %s (%s)", linkPath, bp)
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

func installService(g *libkb.GlobalContext, binPath string, force bool) error {
	bp, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	g.Log.Debug("Using binPath: %s", bp)
	g.Log.Debug("Checking service")
	keybaseStatus := KeybaseServiceStatus(g, "")
	g.Log.Debug("Service: %s (Action: %s)", keybaseStatus.InstallStatus.String(), keybaseStatus.InstallAction.String())
	if keybaseStatus.NeedsInstall() || force {
		g.Log.Debug("Installing Keybase service")
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
	g.Log.Debug("Checking KBFS")
	kbfsStatus := KBFSServiceStatus(g, "")
	g.Log.Debug("KBFS: %s (Action: %s)", kbfsStatus.InstallStatus.String(), kbfsStatus.InstallAction.String())
	if kbfsStatus.NeedsInstall() || force {
		g.Log.Debug("Installing KBFS")
		uninstallKBFSServices(g.Env.GetRunMode())
		_, err := installKBFSService(g, bp)
		if err != nil {
			g.Log.Errorf("Error installing KBFS: %s", err)
			return err
		}
	}

	return nil
}

func Uninstall(g *libkb.GlobalContext, components []string) keybase1.UninstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	g.Log.Debug("Uninstalling components: %s", components)

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = uninstallCommandLine()
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = uninstallKBFS(g)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = uninstallService(g)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	return NewUninstallResult(componentResults)
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

func AutoInstallWithStatus(g *libkb.GlobalContext, binPath string, force bool) keybase1.InstallResult {
	_, res, err := autoInstall(g, binPath, force)
	if err != nil {
		return keybase1.InstallResult{Status: ErrorStatus("INSTALL_ERROR", err.Error())}
	}
	return NewInstallResult(res)
}

func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	newProc, _, err = autoInstall(g, binPath, force)
	return
}

func autoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, componentResults []keybase1.ComponentResult, err error) {
	g.Log.Debug("+ AutoInstall for launchd")
	defer func() {
		g.Log.Debug("- AutoInstall -> %v, %v", newProc, err)
	}()
	label := defaultServiceLabel(g.Env.GetRunMode())
	if label == "" {
		err = fmt.Errorf("No service label to install")
		return
	}

	// Check if plist is installed. If so we're already installed and return.
	plistPath := launchd.PlistDestination(label)
	if _, ferr := os.Stat(plistPath); ferr == nil {
		g.Log.Debug("| already installed at %s", plistPath)
		if !force {
			return
		}
	}

	err = installService(g, binPath, true)
	componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	if err != nil {
		return
	}

	newProc = true
	return
}

func CheckIfValidLocation() error {
	bp, err := binPath()
	if err != nil {
		return err
	}
	inDMG, _, err := isPathInDMG(bp)
	if err != nil {
		return err
	}
	if inDMG {
		return fmt.Errorf("You should copy Keybase to /Applications before running.")
	}
	return nil
}

// isPathInDMG errors if the path is inside dmg
func isPathInDMG(p string) (inDMG bool, bundlePath string, err error) {
	var stat syscall.Statfs_t
	err = syscall.Statfs(p, &stat)
	if err != nil {
		return
	}

	// mntRootFS identifies the root filesystem (http://www.opensource.apple.com/source/xnu/xnu-344.26/bsd/sys/mount.h)
	const mntRootFS = 0x00004000

	if (stat.Flags & mntRootFS) != 0 {
		// We're on the root filesystem so we're not in a DMG
		return
	}

	bundlePath = bundleDirForPath(p)
	if bundlePath != "" {
		// Look for Applications symlink in the same folder as Keybase.app, and if
		// we find it, we're really likely to be in a mounted dmg
		appLink := filepath.Join(filepath.Dir(bundlePath), "Applications")
		fi, ferr := os.Lstat(appLink)
		if os.IsNotExist(ferr) {
			return
		}
		isLink := (fi.Mode()&os.ModeSymlink != 0)
		if isLink {
			inDMG = true
			return
		}
	}

	return
}

func bundleDirForPath(p string) string {
	paths := libkb.SplitPath(p)
	pathJoined := ""
	if strings.HasPrefix(p, "/") {
		pathJoined = "/"
	}
	found := false
	for _, sp := range paths {
		pathJoined = filepath.Join(pathJoined, sp)
		if sp == "Keybase.app" {
			found = true
			break
		}
	}
	if !found {
		return ""
	}
	return filepath.Clean(pathJoined)
}

func NewInstallResult(componentResults []keybase1.ComponentResult) keybase1.InstallResult {
	return keybase1.InstallResult{ComponentResults: componentResults, Status: statusFromResults(componentResults)}
}

func NewUninstallResult(componentResults []keybase1.ComponentResult) keybase1.UninstallResult {
	return keybase1.UninstallResult{ComponentResults: componentResults, Status: statusFromResults(componentResults)}
}

func statusFromResults(componentResults []keybase1.ComponentResult) keybase1.Status {
	var errorMessages []string
	for _, cs := range componentResults {
		if cs.Status.Code != 0 {
			errorMessages = append(errorMessages, fmt.Sprintf("%s (%s)", cs.Status.Desc, cs.Name))
		}
	}

	if len(errorMessages) > 0 {
		return ErrorStatus("ERROR", strings.Join(errorMessages, ". "))
	}

	return keybase1.Status{Name: "OK", Desc: "OK"}
}

func componentResult(name string, err error) keybase1.ComponentResult {
	if err != nil {
		return keybase1.ComponentResult{Name: string(name), Status: errorStatus("INSTALL_ERROR", err.Error())}
	}
	return keybase1.ComponentResult{Name: string(name), Status: keybase1.Status{Name: "OK", Desc: "OK"}}
}
