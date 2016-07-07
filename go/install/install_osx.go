// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/blang/semver"
	"github.com/kardianos/osext"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/mounter"
	"github.com/keybase/client/go/protocol"
)

// defaultLaunchdWait is how long we should wait after install, start, etc
const defaultLaunchdWait = 10 * time.Second

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

// KeybaseServiceStatus returns service status for Keybase service
func KeybaseServiceStatus(context Context, label string, log Log) (status keybase1.ServiceStatus) {
	if label == "" {
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbService, context.GetServiceInfoPath(), log)
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

// KBFSServiceStatus returns service status for KBFS
func KBFSServiceStatus(context Context, label string, log Log) (status keybase1.ServiceStatus) {
	if label == "" {
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbfsService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbfsService, context.GetKBFSInfoPath(), log)
	if err != nil {
		return
	}
	bundleVersion, err := KBFSBundleVersion(context, "")
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

// UpdaterServiceStatus returns service status for the Updater service
func UpdaterServiceStatus(context Context, label string) keybase1.ServiceStatus {
	if label == "" {
		return keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
	}
	serviceStatus := keybase1.ServiceStatus{Label: label}
	updaterService := launchd.NewService(label)
	status, err := updaterService.WaitForStatus(defaultLaunchdWait, 500*time.Millisecond)
	if err != nil {
		serviceStatus.Status = keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, err.Error())
		return serviceStatus
	}
	if status != nil {
		serviceStatus.Pid = status.Pid()
		serviceStatus.LastExitStatus = status.LastExitStatus()
	}
	if serviceStatus.Pid != "" {
		serviceStatus.InstallStatus = keybase1.InstallStatus_INSTALLED
		serviceStatus.InstallAction = keybase1.InstallAction_NONE
	} else {
		serviceStatus.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		serviceStatus.InstallAction = keybase1.InstallAction_INSTALL
	}
	serviceStatus.Status = keybase1.StatusOK("")
	return serviceStatus
}

func serviceStatusFromLaunchd(ls launchd.Service, infoPath string, log Log) (status keybase1.ServiceStatus, err error) {
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
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Label, status.Pid, 40, 500*time.Millisecond, log)
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

func serviceStatusesFromLaunchd(context Context, ls []launchd.Service, log Log) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, _ := serviceStatusFromLaunchd(l, "", log)
		c = append(c, s)
	}
	return c
}

// ListServices returns status for all services
func ListServices(context Context, log Log) (*keybase1.ServicesStatus, error) {
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
		Service: serviceStatusesFromLaunchd(context, services, log),
		Kbfs:    serviceStatusesFromLaunchd(context, kbfs, log),
		Updater: serviceStatusesFromLaunchd(context, updater, log),
	}, nil
}

// DefaultLaunchdEnvVars returns default environment vars for launchd
func DefaultLaunchdEnvVars(label string) []launchd.EnvVar {
	return []launchd.EnvVar{
		launchd.NewEnvVar("KEYBASE_LABEL", label),
		launchd.NewEnvVar("KEYBASE_SERVICE_TYPE", "launchd"),
	}
}

// DefaultServiceLabel returns the default label for Keybase service in launchd
func DefaultServiceLabel(runMode libkb.RunMode) string {
	return defaultServiceLabel(runMode, libkb.IsBrewBuild)
}

func defaultServiceLabel(runMode libkb.RunMode, isBrew bool) string {
	label := AppServiceLabel.String()
	if isBrew {
		label = BrewServiceLabel.String()
	}
	if runMode != libkb.ProductionRunMode {
		label = label + "." + string(runMode)
	}
	return label
}

// DefaultKBFSLabel returns the default label for KBFS service in launchd
func DefaultKBFSLabel(runMode libkb.RunMode) string {
	return defaultKBFSLabel(runMode, libkb.IsBrewBuild)
}

func defaultKBFSLabel(runMode libkb.RunMode, isBrew bool) string {
	label := AppKBFSLabel.String()
	if isBrew {
		label = BrewKBFSLabel.String()
	}
	if runMode != libkb.ProductionRunMode {
		label = label + "." + string(runMode)
	}
	return label
}

// DefaultUpdaterLabel returns the default label for the update service in launchd
func DefaultUpdaterLabel(runMode libkb.RunMode) string {
	label := AppUpdaterLabel.String()
	if runMode != libkb.ProductionRunMode {
		label = label + "." + string(runMode)
	}
	return label
}

const defaultPlistComment = "It's not advisable to edit this plist, it may be overwritten"

func keybasePlist(context Context, binPath string, label string, log Log) (launchd.Plist, error) {
	// TODO: Remove -d when doing real release
	logFile := filepath.Join(context.GetLogDir(), libkb.ServiceLogFileName)
	startLogFile := filepath.Join(context.GetLogDir(), libkb.StartLogFileName)
	err := libkb.MakeParentDirs(startLogFile)
	if err != nil {
		return launchd.Plist{}, err
	}
	plistArgs := []string{"-d", fmt.Sprintf("--log-file=%s", logFile), "service"}
	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", string(context.GetRunMode())))
	return launchd.NewPlist(label, binPath, plistArgs, envVars, startLogFile, defaultPlistComment), nil
}

func installKeybaseService(context Context, service launchd.Service, plist launchd.Plist, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultLaunchdWait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, context.GetServiceInfoPath(), log)
	return &st, err
}

// Uninstall keybase all services for this run mode.
func uninstallKeybaseServices(runMode libkb.RunMode, log Log) error {
	err1 := launchd.Uninstall(defaultServiceLabel(runMode, false), defaultLaunchdWait, log)
	err2 := launchd.Uninstall(defaultServiceLabel(runMode, true), defaultLaunchdWait, log)
	return libkb.CombineErrors(err1, err2)
}

func kbfsPlist(context Context, kbfsBinPath string, label string) (plist launchd.Plist, err error) {
	mountDir, err := context.GetMountDir()
	if err != nil {
		return
	}
	logFile := filepath.Join(context.GetLogDir(), libkb.KBFSLogFileName)
	startLogFile := filepath.Join(context.GetLogDir(), libkb.StartLogFileName)
	err = libkb.MakeParentDirs(startLogFile)
	if err != nil {
		return
	}
	// TODO: Remove debug flag when doing real release
	plistArgs := []string{
		"-debug",
		fmt.Sprintf("-log-file=%s", logFile),
		fmt.Sprintf("-runtime-dir=%s", context.GetRuntimeDir()),
	}

	if context.GetRunMode() == libkb.DevelRunMode {
		plistArgs = append(plistArgs, fmt.Sprintf("-server-root=%s", context.GetRuntimeDir()))
	}

	plistArgs = append(plistArgs, mountDir)

	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", string(context.GetRunMode())))
	plist = launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars, startLogFile, defaultPlistComment)

	_, err = os.Stat(mountDir)
	if err != nil {
		return
	}

	return
}

func installKBFSService(context Context, service launchd.Service, plist launchd.Plist, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultLaunchdWait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", log)
	return &st, err
}

func uninstallKBFSServices(runMode libkb.RunMode, log Log) error {
	err1 := launchd.Uninstall(defaultKBFSLabel(runMode, false), defaultLaunchdWait, log)
	err2 := launchd.Uninstall(defaultKBFSLabel(runMode, true), defaultLaunchdWait, log)
	return libkb.CombineErrors(err1, err2)
}

// NewServiceLabel constructs a service label
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

// ComponentName returns the component name for a service label
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

// ServiceStatus returns status for a service named by label
func ServiceStatus(context Context, label ServiceLabel, log Log) (*keybase1.ServiceStatus, error) {
	switch label.ComponentName() {
	case ComponentNameService:
		st := KeybaseServiceStatus(context, string(label), log)
		return &st, nil
	case ComponentNameKBFS:
		st := KBFSServiceStatus(context, string(label), log)
		return &st, nil
	case ComponentNameUpdater:
		st := UpdaterServiceStatus(context, string(label))
		return &st, nil
	default:
		return nil, fmt.Errorf("Invalid label: %s", label)
	}
}

// Install installs all keybase components
func Install(context Context, binPath string, components []string, force bool, log Log) keybase1.InstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	log.Debug("Installing components: %s", components)

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = installUpdater(context, binPath, force, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
	}

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = installCommandLine(context, binPath, true, log) // Always force CLI install
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = installService(context, binPath, force, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = KBFS(context, binPath, force, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	return newInstallResult(componentResults)
}

func installCommandLine(context Context, binPath string, force bool, log Log) error {
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
	log.Debug("Checking %s (%s)", linkPath, bp)
	err = installCommandLineForBinPath(bp, linkPath, force)
	if err != nil {
		log.Errorf("Command line not installed properly (%s)", err)
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

func installService(context Context, binPath string, force bool, log Log) error {
	resolvedBinPath, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	log.Debug("Using binPath: %s", resolvedBinPath)

	label := DefaultServiceLabel(context.GetRunMode())
	service := launchd.NewService(label)
	plist, err := keybasePlist(context, resolvedBinPath, label, log)
	if err != nil {
		return err
	}
	log.Debug("Checking service: %s", label)
	keybaseStatus := KeybaseServiceStatus(context, label, log)
	log.Debug("Service: %s (Action: %s); %#v", keybaseStatus.InstallStatus.String(), keybaseStatus.InstallAction.String(), keybaseStatus)
	needsInstall := keybaseStatus.NeedsInstall()

	if !needsInstall {
		plistValid, err := service.CheckPlist(plist)
		if err != nil {
			return err
		}
		if !plistValid {
			log.Debug("Needs plist upgrade: %s", service.PlistDestination())
			needsInstall = true
		}
	}

	if needsInstall || force {
		uninstallKeybaseServices(context.GetRunMode(), log)
		log.Debug("Installing Keybase service")
		_, err := installKeybaseService(context, service, plist, log)
		if err != nil {
			log.Errorf("Error installing Keybase service: %s", err)
			return err
		}
	}

	return nil
}

// KBFS installs the KBFS service
func KBFS(context Context, binPath string, force bool, log Log) error {
	runMode := context.GetRunMode()
	label := DefaultKBFSLabel(runMode)
	kbfsService := launchd.NewService(label)
	kbfsBinPath, err := KBFSBinPath(runMode, binPath)
	if err != nil {
		return err
	}
	plist, err := kbfsPlist(context, kbfsBinPath, label)
	if err != nil {
		return err
	}

	log.Debug("Checking KBFS")
	kbfsStatus := KBFSServiceStatus(context, label, log)
	log.Debug("KBFS: %s (Action: %s); %#v", kbfsStatus.InstallStatus.String(), kbfsStatus.InstallAction.String(), kbfsStatus)
	needsInstall := kbfsStatus.NeedsInstall()

	if !needsInstall {
		plistValid, err := kbfsService.CheckPlist(plist)
		if err != nil {
			return err
		}
		if !plistValid {
			log.Debug("Needs plist upgrade: %s", kbfsService.PlistDestination())
			needsInstall = true
		}
	}
	if needsInstall || force {
		uninstallKBFSServices(context.GetRunMode(), log)
		log.Debug("Installing KBFS")
		_, err := installKBFSService(context, kbfsService, plist, log)
		if err != nil {
			log.Errorf("Error installing KBFS: %s", err)
			return err
		}
	}

	return nil
}

// Uninstall uninstalls all keybase services
func Uninstall(context Context, components []string, log Log) keybase1.UninstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	log.Debug("Uninstalling components: %s", components)

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = uninstallCommandLine()
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		var mountDir string
		mountDir, err = context.GetMountDir()
		if err == nil {
			err = UninstallKBFS(context.GetRunMode(), mountDir, true, log)
		}
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = uninstallKeybaseServices(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = uninstallUpdater(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
	}

	return newUninstallResult(componentResults)
}

// UninstallKBFS uninstalls all KBFS services and unmounts the directory
func UninstallKBFS(runMode libkb.RunMode, mountDir string, forceUnmount bool, log Log) error {
	err := uninstallKBFSServices(runMode, log)
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

// AutoInstallWithStatus runs the auto install and returns a result
func AutoInstallWithStatus(context Context, binPath string, force bool, log Log) keybase1.InstallResult {
	_, res, err := autoInstall(context, binPath, force, log)
	if err != nil {
		return keybase1.InstallResult{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error())}
	}
	return newInstallResult(res)
}

// AutoInstall runs the auto install
func AutoInstall(context Context, binPath string, force bool, log Log) (newProc bool, err error) {
	if context.GetRunMode() != libkb.ProductionRunMode {
		return false, fmt.Errorf("Auto install is only supported in production")
	}

	newProc, _, err = autoInstall(context, binPath, force, log)
	return
}

func autoInstall(context Context, binPath string, force bool, log Log) (newProc bool, componentResults []keybase1.ComponentResult, err error) {
	log.Debug("+ AutoInstall for launchd")
	defer func() {
		log.Debug("- AutoInstall -> %v, %v", newProc, err)
	}()
	label := DefaultServiceLabel(context.GetRunMode())
	if label == "" {
		err = fmt.Errorf("No service label to install")
		return
	}
	resolvedBinPath, err := chooseBinPath(binPath)
	if err != nil {
		return
	}
	log.Debug("Using binPath: %s", resolvedBinPath)

	service := launchd.NewService(label)
	plist, err := keybasePlist(context, resolvedBinPath, label, log)
	if err != nil {
		return
	}

	// Check if plist is valid. If so we're already installed and return.
	plistValid, err := service.CheckPlist(plist)
	if err != nil || plistValid {
		return
	}

	err = installService(context, binPath, true, log)
	componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
	if err != nil {
		return
	}

	newProc = true
	return
}

// CheckIfValidLocation checks if the current environment is running from a valid location.
// For example, this will return an error if this isn't running from /Applications/Keybase.app on MacOS.
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

func newInstallResult(componentResults []keybase1.ComponentResult) keybase1.InstallResult {
	return keybase1.InstallResult{ComponentResults: componentResults, Status: statusFromResults(componentResults)}
}

func newUninstallResult(componentResults []keybase1.ComponentResult) keybase1.UninstallResult {
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
		if runMode != libkb.ProductionRunMode {
			return "", fmt.Errorf("Not supported in this run mode")
		}
		kbfsBinName := kbfsBinName()
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

// OSVersion returns the OS version
func OSVersion() (semver.Version, error) {
	out, err := exec.Command("sw_vers", "-productVersion").Output()
	if err != nil {
		return semver.Version{}, err
	}
	return semver.Make(strings.TrimSpace(string(out)))
}

// RunAfterStartup runs after service startup
func RunAfterStartup(context Context, isService bool, log Log) {
	// Ensure the app is running (if it exists and is supported on the platform)
	if libkb.IsBrewBuild {
		return
	}
	if context.GetRunMode() != libkb.ProductionRunMode {
		return
	}
	mode, err := context.GetAppStartMode()
	if err != nil {
		log.Errorf("Error getting app start mode: %s", err)
	}
	log.Debug("App start mode: %s", mode)
	switch mode {
	case libkb.AppStartModeService:
		if !isService {
			return
		}
	case libkb.AppStartModeDisabled:
		return
	}

	if err := RunApp(context, log); err != nil {
		log.Errorf("Error starting the app: %s", err)
	}
}

func installUpdater(context Context, keybaseBinPath string, force bool, log Log) error {
	if context.GetRunMode() != libkb.ProductionRunMode {
		return fmt.Errorf("Updater not supported in this run mode")
	}
	keybaseBinPath, err := chooseBinPath(keybaseBinPath)
	if err != nil {
		return err
	}
	updaterBinPath := filepath.Join(filepath.Dir(keybaseBinPath), "updater")
	if err != nil {
		return err
	}
	log.Debug("Using updater path: %s", updaterBinPath)

	label := DefaultUpdaterLabel(context.GetRunMode())
	service := launchd.NewService(label)
	plist, err := updaterPlist(context, label, updaterBinPath, keybaseBinPath)
	if err != nil {
		return err
	}

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
		uninstallUpdater(context.GetRunMode(), log)
		log.Debug("Installing updater service")
		_, err := installUpdaterService(service, plist, log)
		if err != nil {
			log.Errorf("Error installing updater service: %s", err)
			return err
		}
	}

	return nil
}

func updaterPlist(context Context, label string, serviceBinPath string, keybaseBinPath string) (launchd.Plist, error) {
	plistArgs := []string{fmt.Sprintf("-path-to-keybase=%s", keybaseBinPath)}
	envVars := DefaultLaunchdEnvVars(label)
	comment := "It's not advisable to edit this plist, it may be overwritten"
	logFile := filepath.Join(context.GetLogDir(), libkb.UpdaterLogFileName)
	err := libkb.MakeParentDirs(logFile)
	if err != nil {
		return launchd.Plist{}, err
	}
	return launchd.NewPlist(label, serviceBinPath, plistArgs, envVars, logFile, comment), nil
}

func installUpdaterService(service launchd.Service, plist launchd.Plist, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, defaultLaunchdWait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", log)
	return &st, err
}

func uninstallUpdater(runMode libkb.RunMode, log Log) error {
	return launchd.Uninstall(DefaultUpdaterLabel(runMode), defaultLaunchdWait, log)
}

// kbfsBinName returns the name for the KBFS executable
func kbfsBinName() string {
	return "kbfs"
}

func updaterBinName() (string, error) {
	return "updater", nil
}

// AppBundleForPath returns path to app bundle
func AppBundleForPath() (string, error) {
	path, err := osext.Executable()
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", err
	}
	paths := strings.SplitN(path, ".app", 2)
	// If no match, return ""
	if len(paths) <= 1 {
		return "", fmt.Errorf("Unable to resolve bundle for valid path: %s; %s", path, err)
	}

	appPath := paths[0] + ".app"
	if exists, _ := libkb.FileExists(appPath); !exists {
		return "", fmt.Errorf("App not found: %s", appPath)
	}

	return appPath, nil
}

// RunApp starts the app
func RunApp(context Context, log Log) error {
	appPath, err := AppBundleForPath()
	if err != nil {
		return err
	}
	ver, err := OSVersion()
	if err != nil {
		log.Errorf("Error trying to determine OS version: %s", err)
		return nil
	}
	if ver.LT(semver.MustParse("10.0.0")) {
		return fmt.Errorf("App isn't supported on this OS version: %s", ver)
	}

	log.Info("Opening %s", appPath)
	// If app is already open this is a no-op, the -g option will cause to open
	// in background.
	out, err := exec.Command("/usr/bin/open", "-g", appPath).Output()
	if err != nil {
		return fmt.Errorf("Error trying to open %s: %s; %s", appPath, err, out)
	}
	return nil
}
