// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/mounter"
	keybase1 "github.com/keybase/client/go/protocol"
)

// defaultWait is how long we should wait after install, start, etc
const defaultWait = 5 * time.Second

// ServiceLabel is an identifier string for a service
type ServiceLabel string

const (
	// AppServiceLabel is the service label for the keybase launchd service in Keybase.app
	AppServiceLabel ServiceLabel = "keybase.service"
	// AppKBFSLabel is the service label for the kbfs launchd service in Keybase.app
	AppKBFSLabel ServiceLabel = "keybase.kbfs"
	// AppUpdaterLabel is the service label for the updater launchd service in Keybase.app
	AppUpdaterLabel ServiceLabel = "keybase.updater"
	// BrewServiceLabel is the service label for the updater launchd service in homebrew
	BrewServiceLabel ServiceLabel = "homebrew.mxcl.keybase"
	// BrewKBFSLabel is the service label for the kbfs launchd service in homebrew
	BrewKBFSLabel ServiceLabel = "homebrew.mxcl.kbfs"
	// UnknownLabel is an empty/unknown label
	UnknownLabel ServiceLabel = ""
)

func KeybaseServiceStatus(g *libkb.GlobalContext, label string) (status keybase1.ServiceStatus) {
	if label == "" {
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"), g.Log)
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
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbfsService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbfsService, path.Join(g.Env.GetRuntimeDir(), "kbfs.info"), g.Log)
	if err != nil {
		return
	}
	bundleVersion, err := KBFSBundleVersion(g, "")
	if err != nil {
		status.Status = keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())
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

func UpdaterServiceStatus(g *libkb.GlobalContext, label string) keybase1.ServiceStatus {
	if label == "" {
		return keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
	}
	updaterService := launchd.NewService(label)
	status, err := updaterService.WaitForStatus(5*time.Second, 500*time.Millisecond)
	if err != nil {
		return keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())}
	}
	serviceStatus := keybase1.ServiceStatus{
		Label:          label,
		Pid:            status.Pid(),
		LastExitStatus: status.LastExitStatus(),
	}
	if status.Pid() != "" {
		serviceStatus.InstallStatus = keybase1.InstallStatus_INSTALLED
		serviceStatus.InstallAction = keybase1.InstallAction_NONE
	} else {
		serviceStatus.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		serviceStatus.InstallAction = keybase1.InstallAction_INSTALL
	}
	serviceStatus.Status = keybase1.StatusOK("")
	return serviceStatus
}

func serviceStatusFromLaunchd(ls launchd.Service, infoPath string, log logger.Logger) (status keybase1.ServiceStatus, err error) {
	status = keybase1.ServiceStatus{
		Label: ls.Label(),
	}

	launchdStatus, err := ls.LoadStatus()
	if err != nil {
		status.InstallStatus = keybase1.InstallStatus_ERROR
		status.InstallAction = keybase1.InstallAction_NONE
		status.Status = keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())
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
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Label, status.Pid, 40, 500*time.Millisecond, "service status", log)
			if err != nil {
				status.InstallStatus = keybase1.InstallStatus_ERROR
				status.InstallAction = keybase1.InstallAction_REINSTALL
				status.Status = keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())
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
		status.Status = keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())
		return
	}

	status.Status = keybase1.Status{Name: "OK"}
	return
}

func serviceStatusesFromLaunchd(g *libkb.GlobalContext, ls []launchd.Service) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, _ := serviceStatusFromLaunchd(l, "", g.Log)
		c = append(c, s)
	}
	return c
}

func ListServices(g *libkb.GlobalContext) (*keybase1.ServicesStatus, error) {
	services, err := launchd.ListServices([]string{"keybase.service", "homebrew.mxcl.keybase"})
	if err != nil {
		return nil, err
	}
	kbfs, err := launchd.ListServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"})
	if err != nil {
		return nil, err
	}
	updater, err := launchd.ListServices([]string{"keybase.updater."})
	if err != nil {
		return nil, err
	}

	return &keybase1.ServicesStatus{
		Service: serviceStatusesFromLaunchd(g, services),
		Kbfs:    serviceStatusesFromLaunchd(g, kbfs),
		Updater: serviceStatusesFromLaunchd(g, updater),
	}, nil
}

func DefaultLaunchdEnvVars(label string) []launchd.EnvVar {
	return []launchd.EnvVar{
		launchd.NewEnvVar("KEYBASE_LABEL", label),
		launchd.NewEnvVar("KEYBASE_SERVICE_TYPE", "launchd"),
	}
}

func DefaultServiceLabel() string {
	if libkb.IsBrewBuild {
		return BrewServiceLabel.String()
	}
	return AppServiceLabel.String()
}

func DefaultKBFSLabel() string {
	if libkb.IsBrewBuild {
		return BrewKBFSLabel.String()
	}
	return AppKBFSLabel.String()
}

func keybasePlist(g *libkb.GlobalContext, binPath string, label string) launchd.Plist {
	// TODO: Remove -d when doing real release
	logFile := filepath.Join(launchd.LogDir(), libkb.ServiceLogFileName)
	plistArgs := []string{"-d", fmt.Sprintf("--log-file=%s", logFile), "service"}
	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", g.Env.GetRunModeAsString()))
	comment := "It's not advisable to edit this plist, it may be overwritten"
	return launchd.NewPlist(label, binPath, plistArgs, envVars, libkb.StartLogFileName, comment)
}

func installKeybaseService(g *libkb.GlobalContext, service launchd.Service, plist launchd.Plist) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultWait, g.Log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, g.Env.GetServiceInfoPath(), g.Log)
	return &st, err
}

// Uninstall keybase all services for this run mode.
func uninstallKeybaseServices(runMode libkb.RunMode) error {
	err1 := launchd.Uninstall(AppServiceLabel.String(), defaultWait, nil)
	err2 := launchd.Uninstall(BrewServiceLabel.String(), defaultWait, nil)
	return libkb.CombineErrors(err1, err2)
}

func kbfsPlist(g *libkb.GlobalContext, kbfsBinPath string, label string) (plist launchd.Plist, err error) {
	mountDir, err := g.Env.GetMountDir()
	if err != nil {
		return
	}
	// TODO: This log file path is the same as the default, so we can probably
	// change the KBFS args to use -log-to-file param instead.
	logFile := filepath.Join(launchd.LogDir(), libkb.KBFSLogFileName)
	// TODO: Remove debug flag when doing real release
	plistArgs := []string{
		"-debug",
		fmt.Sprintf("-log-file=%s", logFile),
		fmt.Sprintf("-runtime-dir=%s", g.Env.GetRuntimeDir()),
		mountDir,
	}
	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", g.Env.GetRunModeAsString()))
	comment := "It's not advisable to edit this plist, it may be overwritten"
	plist = launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars, libkb.StartLogFileName, comment)

	_, err = os.Stat(mountDir)
	if err != nil {
		return
	}

	return
}

func installKBFSService(g *libkb.GlobalContext, service launchd.Service, plist launchd.Plist) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultWait, g.Log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", g.Log)
	return &st, err
}

func uninstallKBFSServices(runMode libkb.RunMode) error {
	err1 := launchd.Uninstall(AppKBFSLabel.String(), defaultWait, nil)
	err2 := launchd.Uninstall(BrewKBFSLabel.String(), defaultWait, nil)
	return libkb.CombineErrors(err1, err2)
}

func NewServiceLabel(s string) (ServiceLabel, error) {
	switch s {
	case string(AppServiceLabel):
		return AppServiceLabel, nil
	case string(BrewServiceLabel):
		return BrewServiceLabel, nil
	case string(AppKBFSLabel):
		return AppKBFSLabel, nil
	case string(BrewKBFSLabel):
		return BrewKBFSLabel, nil
	case string(AppUpdaterLabel):
		return AppUpdaterLabel, nil
	}
	return UnknownLabel, fmt.Errorf("Unknown service label: %s", s)
}

func (l ServiceLabel) String() string {
	return string(l)
}

func (l ServiceLabel) ComponentName() ComponentName {
	switch l {
	case AppServiceLabel, BrewServiceLabel:
		return ComponentNameService
	case AppKBFSLabel, BrewKBFSLabel:
		return ComponentNameKBFS
	case AppUpdaterLabel:
		return ComponentNameUpdater
	}
	return ComponentNameUnknown
}

func ServiceStatus(g *libkb.GlobalContext, label ServiceLabel) (*keybase1.ServiceStatus, error) {
	switch label.ComponentName() {
	case ComponentNameService:
		st := KeybaseServiceStatus(g, string(label))
		return &st, nil
	case ComponentNameKBFS:
		st := KBFSServiceStatus(g, string(label))
		return &st, nil
	case ComponentNameUpdater:
		st := UpdaterServiceStatus(g, string(label))
		return &st, nil
	default:
		return nil, fmt.Errorf("Invalid label: %s", label)
	}
}

func Install(g *libkb.GlobalContext, binPath string, components []string, force bool) keybase1.InstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	g.Log.Debug("Installing components: %s", components)

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = installUpdater(binPath, force, g.Log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
	}

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = installCommandLine(g, binPath, true) // Always force CLI install
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = installService(g, binPath, force)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = InstallKBFS(g, binPath, force)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	return NewInstallResult(componentResults)
}

func installCommandLine(g *libkb.GlobalContext, binPath string, force bool) error {
	bp, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	linkPath, err := defaultLinkPath()
	if err != nil {
		return err
	}
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
	resolvedBinPath, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	g.Log.Debug("Using binPath: %s", resolvedBinPath)

	label := DefaultServiceLabel()
	service := launchd.NewService(label)
	plist := keybasePlist(g, resolvedBinPath, label)
	g.Log.Debug("Checking service: %s", label)
	keybaseStatus := KeybaseServiceStatus(g, label)
	g.Log.Debug("Service: %s (Action: %s)", keybaseStatus.InstallStatus.String(), keybaseStatus.InstallAction.String())
	needsInstall := keybaseStatus.NeedsInstall()

	if !needsInstall {
		plistValid, err := service.CheckPlist(plist)
		if err != nil {
			return err
		}
		if !plistValid {
			g.Log.Debug("Needs plist upgrade: %s", service.PlistDestination())
			needsInstall = true
		}
	}

	if needsInstall || force {
		uninstallKeybaseServices(g.Env.GetRunMode())
		g.Log.Debug("Installing Keybase service")
		_, err := installKeybaseService(g, service, plist)
		if err != nil {
			g.Log.Errorf("Error installing Keybase service: %s", err)
			return err
		}
	}

	return nil
}

func InstallKBFS(g *libkb.GlobalContext, binPath string, force bool) error {
	runMode := g.Env.GetRunMode()
	label := DefaultKBFSLabel()
	kbfsService := launchd.NewService(label)
	kbfsBinPath, err := KBFSBinPath(runMode, binPath)
	if err != nil {
		return err
	}
	plist, err := kbfsPlist(g, kbfsBinPath, label)
	if err != nil {
		return err
	}

	g.Log.Debug("Checking KBFS")
	kbfsStatus := KBFSServiceStatus(g, label)
	g.Log.Debug("KBFS: %s (Action: %s)", kbfsStatus.InstallStatus.String(), kbfsStatus.InstallAction.String())
	needsInstall := kbfsStatus.NeedsInstall()

	if !needsInstall {
		plistValid, err := kbfsService.CheckPlist(plist)
		if err != nil {
			return err
		}
		if !plistValid {
			g.Log.Debug("Needs plist upgrade: %s", kbfsService.PlistDestination())
			needsInstall = true
		}
	}
	if needsInstall || force {
		uninstallKBFSServices(g.Env.GetRunMode())
		g.Log.Debug("Installing KBFS")
		_, err := installKBFSService(g, kbfsService, plist)
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
		mountDir, err := g.Env.GetMountDir()
		if err == nil {
			err = UninstallKBFS(g.Env.GetRunMode(), mountDir, true, g.Log)
		}
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = uninstallKeybaseServices(g.Env.GetRunMode())
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = uninstallUpdater()
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
	}

	return NewUninstallResult(componentResults)
}

// UninstallKBFS uninstalls all KBFS services and unmounts the directory
func UninstallKBFS(runMode libkb.RunMode, mountDir string, forceUnmount bool, log logger.Logger) error {
	err := uninstallKBFSServices(runMode)
	if err != nil {
		return err
	}

	if _, serr := os.Stat(mountDir); os.IsNotExist(serr) {
		return nil
	}
	log.Debug("Checking if mounted: %s", mountDir)
	mounted, err := mounter.IsMounted(mountDir, log)
	if err != nil {
		return err
	}
	log.Debug("Mounted: %s", strconv.FormatBool(mounted))
	if mounted {
		err = mounter.Unmount(mountDir, forceUnmount, log)
		if err != nil {
			return err
		}
	}
	empty, err := libkb.IsDirEmpty(mountDir)
	if err != nil {
		return err
	}
	if !empty {
		return fmt.Errorf("Mount has files after unmounting: %s", mountDir)
	}
	// TODO: We should remove the mountPath via trashDir(g, mountPath) but given
	// permissions of /keybase we'll need the privileged tool to do it instead.
	return nil
}

func AutoInstallWithStatus(g *libkb.GlobalContext, binPath string, force bool) keybase1.InstallResult {
	_, res, err := autoInstall(g, binPath, force)
	if err != nil {
		return keybase1.InstallResult{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error())}
	}
	return NewInstallResult(res)
}

func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		return false, fmt.Errorf("Auto install is only supported in production")
	}

	newProc, _, err = autoInstall(g, binPath, force)
	return
}

func autoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, componentResults []keybase1.ComponentResult, err error) {
	g.Log.Debug("+ AutoInstall for launchd")
	defer func() {
		g.Log.Debug("- AutoInstall -> %v, %v", newProc, err)
	}()
	label := DefaultServiceLabel()
	if label == "" {
		err = fmt.Errorf("No service label to install")
		return
	}
	resolvedBinPath, err := chooseBinPath(binPath)
	if err != nil {
		return
	}
	g.Log.Debug("Using binPath: %s", resolvedBinPath)

	service := launchd.NewService(label)
	plist := keybasePlist(g, resolvedBinPath, label)

	// Check if plist is valid. If so we're already installed and return.
	plistValid, err := service.CheckPlist(plist)
	if err != nil || plistValid {
		return
	}

	err = installService(g, binPath, true)
	componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	if err != nil {
		return
	}

	newProc = true
	return
}

func CheckIfValidLocation() *keybase1.Error {
	keybasePath, err := BinPath()
	if err != nil {
		return keybase1.FromError(err)
	}
	inDMG, _, err := isPathInDMG(keybasePath)
	if err != nil {
		return keybase1.FromError(err)
	}
	if inDMG {
		return keybase1.NewError(keybase1.StatusCode_SCInvalidLocationError, "You should copy Keybase to /Applications before running.")
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
		return keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, strings.Join(errorMessages, ". "))
	}

	return keybase1.StatusOK("")
}

func componentResult(name string, err error) keybase1.ComponentResult {
	if err != nil {
		return keybase1.ComponentResult{Name: string(name), Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error())}
	}
	return keybase1.ComponentResult{Name: string(name), Status: keybase1.StatusOK("")}
}

// KBFSBinPath returns the path to the KBFS executable.
// If binPath (directory) is specifed, it will override the default (which is in
// the same directory where the keybase executable is).
func KBFSBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	// If it's brew lookup path by formula name
	if libkb.IsBrewBuild {
		kbfsBinName, err := kbfsBinName(runMode)
		if err != nil {
			return "", err
		}
		prefix, err := brewPath(kbfsBinName)
		if err != nil {
			return "", err
		}
		return filepath.Join(prefix, "bin", kbfsBinName), nil
	}

	return kbfsBinPathDefault(runMode, binPath)
}

func brewPath(formula string) (string, error) {
	// Get the homebrew install path prefix for this formula
	prefixOutput, err := exec.Command("brew", "--prefix", formula).Output()
	if err != nil {
		return "", fmt.Errorf("Error checking brew path: %s", err)
	}
	prefix := strings.TrimSpace(string(prefixOutput))
	return prefix, nil
}

func OSVersion() (semver.Version, error) {
	out, err := exec.Command("sw_vers", "-productVersion").Output()
	if err != nil {
		return semver.Version{}, err
	}
	return semver.Make(strings.TrimSpace(string(out)))
}

func RunAfterStartup(g *libkb.GlobalContext, isService bool) error {
	// Ensure the app is running (if it exists and is supported on the platform)
	if libkb.IsBrewBuild {
		return nil
	}
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		return nil
	}
	g.Log.Debug("App start mode: %s", g.Env.GetAppStartMode())
	switch g.Env.GetAppStartMode() {
	case libkb.AppStartModeService:
		if !isService {
			return nil
		}
	case libkb.AppStartModeDisabled:
		return nil
	}

	appPath := "/Applications/Keybase.app"
	if exists, _ := libkb.FileExists(appPath); !exists {
		g.Log.Debug("App start is unavailable (App not found at %s)", appPath)
		return nil
	}
	ver, err := OSVersion()
	if err != nil {
		g.Log.Errorf("Error trying to determine OS version: %s", err)
		return nil
	}
	if ver.LT(semver.MustParse("10.0.0")) {
		g.Log.Debug("App isn't supported on this OS version: %s", ver)
		return nil
	}

	g.Log.Debug("Ensuring app is open: %s", appPath)
	// If app is already open this is a no-op, the -g option will cause to open
	// in background.
	out, err := exec.Command("/usr/bin/open", "-g", appPath).Output()
	if err != nil {
		g.Log.Errorf("Error trying to open Keybase.app; %s; %s", err, out)
	}
	return nil
}

func installUpdater(keybaseBinPath string, force bool, log logger.Logger) error {
	keybaseBinPath, err := chooseBinPath(keybaseBinPath)
	if err != nil {
		return err
	}
	updaterBinPath := filepath.Join(filepath.Dir(keybaseBinPath), "updater")
	if err != nil {
		return err
	}
	log.Debug("Using updater path: %s", updaterBinPath)

	label := string(AppUpdaterLabel)
	service := launchd.NewService(label)
	plist := keybaseUpdaterPlist(label, updaterBinPath, keybaseBinPath)

	launchdStatus, err := service.LoadStatus()
	if err != nil {
		return err
	}

	needsInstall := false
	if launchdStatus == nil {
		log.Debug("No status, needs install")
		needsInstall = true
	}

	if !needsInstall {
		plistValid, err := service.CheckPlist(plist)
		if err != nil {
			return err
		}
		if !plistValid {
			log.Debug("Plist needs update: %s", service.PlistDestination())
			needsInstall = true
		}
	}

	if needsInstall || force {
		uninstallUpdater()
		log.Debug("Installing updater service")
		_, err := installUpdaterService(service, plist, log)
		if err != nil {
			log.Errorf("Error installing updater service: %s", err)
			return err
		}
	}

	return nil
}

func keybaseUpdaterPlist(label string, serviceBinPath string, keybaseBinPath string) launchd.Plist {
	plistArgs := []string{fmt.Sprintf("-path-to-keybase=%s", keybaseBinPath)}
	envVars := DefaultLaunchdEnvVars(label)
	comment := "It's not advisable to edit this plist, it may be overwritten"
	return launchd.NewPlist(label, serviceBinPath, plistArgs, envVars, libkb.UpdaterLogFileName, comment)
}

func installUpdaterService(service launchd.Service, plist launchd.Plist, log logger.Logger) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultWait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", log)
	return &st, err
}

func uninstallUpdater() error {
	return launchd.Uninstall(string(AppUpdaterLabel), defaultWait, nil)
}
