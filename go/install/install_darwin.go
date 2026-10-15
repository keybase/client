// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/install/adminprompt"
	"github.com/keybase/client/go/install/libnativeinstaller"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/mounter"
	"github.com/keybase/client/go/protocol/keybase1"
)

// defaultLaunchdWait is how long we should wait after install & start.
// We should make this shorter if the app is started by the user (so
// they get more immediate feedback), and longer if the app is started
// after boot (when it takes longer for things to start).
const defaultLaunchdWait = 20 * time.Second

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

const (
	macfusePath      = "/Library/Filesystems/macfuse.fs"
	loadMacfusePath  = macfusePath + "/Contents/Resources/load_macfuse"
	legacyKbfusePath = "/Library/Filesystems/kbfuse.fs"

	// exitCodeKextNotLoadable means macFUSE is installed but macOS has not
	// allowed its kext yet. The app shows the approval help for it.
	exitCodeKextNotLoadable = 5
	msgKextNotLoadable      = "macFUSE is installed, but macOS has not allowed its system extension yet."
)

// KeybaseServiceStatus returns service status for Keybase service
func KeybaseServiceStatus(context Context, label string, wait time.Duration, log Log) (status keybase1.ServiceStatus) {
	if label == "" {
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbService, context.GetServiceInfoPath(), wait, log)
	status.BundleVersion = libkb.VersionString()
	if err != nil {
		return
	}
	if status.InstallStatus == keybase1.InstallStatus_NOT_INSTALLED {
		return
	}

	installStatus, installAction, kbStatus := ResolveInstallStatus(status.Version, status.BundleVersion, status.LastExitStatus, log)
	status.InstallStatus = installStatus
	status.InstallAction = installAction
	status.Status = kbStatus
	return
}

// KBFSServiceStatus returns service status for KBFS
func KBFSServiceStatus(context Context, label string, wait time.Duration, log Log) (status keybase1.ServiceStatus) {
	if label == "" {
		status = keybase1.ServiceStatus{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCServiceStatusError, "No service label")}
		return
	}
	kbfsService := launchd.NewService(label)

	status, err := serviceStatusFromLaunchd(kbfsService, context.GetKBFSInfoPath(), wait, log)
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

	installStatus, installAction, kbStatus := ResolveInstallStatus(status.Version, status.BundleVersion, status.LastExitStatus, log)
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

func serviceStatusFromLaunchd(ls launchd.Service, infoPath string, wait time.Duration, log Log) (status keybase1.ServiceStatus, err error) {
	status = keybase1.ServiceStatus{
		Label: ls.Label(),
	}

	launchdStatus, err := ls.WaitForStatus(wait, 500*time.Millisecond)
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
			serviceInfo, err = libkb.WaitForServiceInfoFile(infoPath, status.Label, status.Pid, wait, log)
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

func serviceStatusesFromLaunchd(context Context, ls []launchd.Service, wait time.Duration, log Log) []keybase1.ServiceStatus {
	c := []keybase1.ServiceStatus{}
	for _, l := range ls {
		s, _ := serviceStatusFromLaunchd(l, "", wait, log)
		c = append(c, s)
	}
	return c
}

// ListServices returns status for all services
func ListServices(context Context, wait time.Duration, log Log) (*keybase1.ServicesStatus, error) {
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
		Service: serviceStatusesFromLaunchd(context, services, wait, log),
		Kbfs:    serviceStatusesFromLaunchd(context, kbfs, wait, log),
		Updater: serviceStatusesFromLaunchd(context, updater, wait, log),
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
	err := libkb.MakeParentDirs(log, startLogFile)
	if err != nil {
		return launchd.Plist{}, err
	}
	plistArgs := []string{"-d", fmt.Sprintf("--log-file=%s", logFile), "service"}
	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", string(context.GetRunMode())))
	return launchd.NewPlist(label, binPath, plistArgs, envVars, startLogFile, defaultPlistComment), nil
}

func installKeybaseService(context Context, service launchd.Service, plist launchd.Plist, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, wait, log)
	if err != nil {
		log.Warning("error installing keybase service via launchd: %s", err)
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, context.GetServiceInfoPath(), wait, log)
	return &st, err
}

// UninstallKeybaseServices removes the keybase service (includes homebrew)
func UninstallKeybaseServices(context Context, log Log) error {
	runMode := context.GetRunMode()
	err0 := fallbackKillProcess(context, log, defaultServiceLabel(runMode, false), context.GetServiceInfoPath(), "")
	err1 := launchd.Uninstall(defaultServiceLabel(runMode, false), defaultLaunchdWait, log)
	err2 := launchd.Uninstall(defaultServiceLabel(runMode, true), defaultLaunchdWait, log)
	return libkb.CombineErrors(err0, err1, err2)
}

func kbfsPlist(context Context, kbfsBinPath string, label string, mountDir string, skipMount bool, log Log) (launchd.Plist, error) {
	logFile := filepath.Join(context.GetLogDir(), libkb.KBFSLogFileName)
	startLogFile := filepath.Join(context.GetLogDir(), libkb.StartLogFileName)
	if err := libkb.MakeParentDirs(log, startLogFile); err != nil {
		return launchd.Plist{}, err
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

	if skipMount {
		plistArgs = append(plistArgs, "-mount-type=none")
	}

	plistArgs = append(plistArgs, mountDir)

	envVars := DefaultLaunchdEnvVars(label)
	envVars = append(envVars, launchd.NewEnvVar("KEYBASE_RUN_MODE", string(context.GetRunMode())))
	plist := launchd.NewPlist(label, kbfsBinPath, plistArgs, envVars, startLogFile, defaultPlistComment)
	return plist, nil
}

func installKBFSService(context Context, service launchd.Service, plist launchd.Plist, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, wait, log)
	if err != nil {
		log.Warning("error installing kbfs service via launchd: %s", err)
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", wait, log)
	return &st, err
}

// UninstallKBFSServices removes KBFS service (including homebrew)
func UninstallKBFSServices(context Context, log Log) error {
	runMode := context.GetRunMode()
	err0 := fallbackKillProcess(context, log, defaultKBFSLabel(runMode, false), context.GetKBFSInfoPath(), "")
	err1 := launchd.Uninstall(defaultKBFSLabel(runMode, false), defaultLaunchdWait, log)
	err2 := launchd.Uninstall(defaultKBFSLabel(runMode, true), defaultLaunchdWait, log)
	return libkb.CombineErrors(err0, err1, err2)
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
func ServiceStatus(context Context, label ServiceLabel, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	switch label.ComponentName() {
	case ComponentNameService:
		st := KeybaseServiceStatus(context, string(label), wait, log)
		return &st, nil
	case ComponentNameKBFS:
		st := KBFSServiceStatus(context, string(label), wait, log)
		return &st, nil
	case ComponentNameUpdater:
		st := UpdaterServiceStatus(context, string(label))
		return &st, nil
	default:
		return nil, fmt.Errorf("Invalid label: %s", label)
	}
}

func pathExists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

// installAutoComponents are the components install-auto installs. None of
// them needs privileges or macFUSE; kbfs mounts only when the user opted in
// and macFUSE is ready.
func installAutoComponents() []string {
	return []string{
		ComponentNameCLI.String(),
		ComponentNameUpdater.String(),
		ComponentNameService.String(),
		ComponentNameKBFS.String(),
	}
}

// InstallAuto installs everything it can without asking for privileges.
func InstallAuto(context Context, binPath string, timeout time.Duration, log Log) keybase1.InstallResult {
	return Install(context, binPath, installAutoComponents(), true, timeout, log)
}

// shouldMountKBFS reports whether kbfs should mount: the user turned on
// Finder access and a supported macFUSE is installed.
func shouldMountKBFS(optIn bool, st keybase1.FuseStatus) bool {
	return optIn && macfuseReady(st)
}

// macfuseReady reports whether a supported macFUSE is installed. Its kext
// may still need to be loaded.
func macfuseReady(st keybase1.FuseStatus) bool {
	return st.InstallStatus == keybase1.InstallStatus_INSTALLED &&
		st.InstallAction == keybase1.InstallAction_NONE
}

// ensureMacfuse checks that stock macFUSE is installed and up to date, and
// loads its kext. Keybase never installs macFUSE itself.
func ensureMacfuse(log Log) keybase1.ComponentResult {
	name := ComponentNameFuse.String()
	st := KeybaseFuseStatus("", log)
	if !macfuseReady(st) {
		log.Errorf("%s", st.Status.Desc)
		return keybase1.ComponentResult{Name: name, Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, st.Status.Desc)}
	}
	if st.KextStarted {
		return componentResult(name, nil)
	}
	// load_macfuse is setuid root. When macOS has not allowed the kext it
	// exits non-zero with no output and macOS shows its own dialog.
	out, err := exec.Command(loadMacfusePath).CombinedOutput()
	log.Debug("load_macfuse: err=%v output=%q", err, out)
	if st = KeybaseFuseStatus("", log); macfuseReady(st) && st.KextStarted {
		return componentResult(name, nil)
	}
	log.Errorf("%s", msgKextNotLoadable)
	return keybase1.ComponentResult{
		Name:     name,
		Status:   keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, msgKextNotLoadable),
		ExitCode: exitCodeKextNotLoadable,
	}
}

func appComponentResult(log Log) keybase1.ComponentResult {
	err := errors.New("the app component is not supported on macOS")
	log.Errorf("%s", err)
	return componentResult(ComponentNameApp.String(), err)
}

// Install installs specified components
func Install(context Context, binPath string, components []string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	log.Debug("Installing components: %s", components)
	cleanupLegacyKBNM(log)

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = installCommandLine(context, binPath, true, log) // Always force CLI install
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
		if err != nil {
			log.Errorf("Error installing CLI: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameApp), components, false) {
		componentResults = append(componentResults, appComponentResult(log))
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = InstallUpdater(context, binPath, force, timeout, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
		if err != nil {
			log.Errorf("Error installing updater: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = InstallService(context, binPath, force, timeout, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
		if err != nil {
			log.Errorf("Error installing service: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameFuse), components, false) {
		componentResults = append(componentResults, ensureMacfuse(log))
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = InstallKBFS(context, binPath, timeout, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
		if err != nil {
			log.Errorf("Error installing KBFS: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameCLIPaths), components, false) {
		err = installCommandLinePrivileged(log)
		componentResults = append(componentResults, componentResult(string(ComponentNameCLIPaths), err))
		if err != nil {
			log.Errorf("Error installing command line (privileged): %s", err)
		}
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
	log.Info("Checking %s (%s)", linkPath, bp)
	err = installCommandLineForBinPath(bp, linkPath, force, log)
	if err != nil {
		log.Errorf("Command line not installed properly (%s)", err)
		return err
	}

	// Now the git remote helper. Lives next to the keybase binary, same dir
	gitBinFilename := "git-remote-keybase"
	gitBinPath := filepath.Join(filepath.Dir(bp), gitBinFilename)
	gitLinkPath := filepath.Join(filepath.Dir(linkPath), gitBinFilename)
	err = installCommandLineForBinPath(gitBinPath, gitLinkPath, force, log)
	if err != nil {
		log.Errorf("Git remote helper not installed properly (%s)", err)
		return err
	}

	return nil
}

func createCommandLine(binPath string, linkPath string, log Log) error {
	if _, err := os.Lstat(linkPath); err == nil {
		err := os.Remove(linkPath)
		if err != nil {
			return err
		}
	}

	log.Info("Linking %s to %s", linkPath, binPath)
	return os.Symlink(binPath, linkPath)
}

func installCommandLineForBinPath(binPath string, linkPath string, force bool, log Log) error {
	fi, err := os.Lstat(linkPath)
	if os.IsNotExist(err) {
		// Doesn't exist, create
		return createCommandLine(binPath, linkPath, log)
	}
	isLink := (fi.Mode()&os.ModeSymlink != 0)
	if !isLink {
		if force {
			log.Warning("Path is not a symlink: %s, forcing overwrite", linkPath)
			return createCommandLine(binPath, linkPath, log)
		}
		return fmt.Errorf("Path is not a symlink: %s", linkPath)
	}

	// Check that the symlink evals to this binPath or error
	dest, err := filepath.EvalSymlinks(linkPath)
	if err == nil && binPath != dest {
		err = fmt.Errorf("We are not symlinked to %s", linkPath)
	}
	if err != nil {
		if force {
			log.Warning("We are not symlinked to %s, forcing overwrite", linkPath)
			return createCommandLine(binPath, linkPath, log)
		}
		return fmt.Errorf("We are not symlinked to %s", linkPath)
	}

	return nil
}

// InstallService installs the launchd service
func InstallService(context Context, binPath string, force bool, timeout time.Duration, log Log) error {
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
	if err = UninstallKeybaseServices(context, log); err != nil {
		log.Debug("unable to uninstall service: %s", err)
	}
	log.Debug("Installing service (%s, timeout=%s)", label, timeout)
	if _, err := installKeybaseService(context, service, plist, timeout, log); err != nil {
		log.Errorf("Error installing Keybase service: %s", err)
		pid, err := fallbackStartProcessAndWaitForInfo(context, service, plist, context.GetServiceInfoPath(), timeout, log)
		if err != nil {
			return err
		}
		log.Debug("fallback keybase service started, pid=%d", pid)
		return nil
	}
	log.Debug("keybase service installed via launchd successfully")
	return nil
}

// InstallKBFS installs the KBFS launchd service
func InstallKBFS(context Context, binPath string, timeout time.Duration, log Log) error {
	runMode := context.GetRunMode()
	label := DefaultKBFSLabel(runMode)
	kbfsService := launchd.NewService(label)
	kbfsBinPath, err := KBFSBinPath(runMode, binPath)
	if err != nil {
		return err
	}
	mountDir, err := context.GetMountDir()
	if err != nil {
		return err
	}

	// The mount directory need not exist: mount_macfuse creates it.
	skipMount := !shouldMountKBFS(MountOptIn(context), KeybaseFuseStatus("", log))
	log.Debug("KBFS mount at %s skipped: %v", mountDir, skipMount)

	plist, err := kbfsPlist(context, kbfsBinPath, label, mountDir, skipMount, log)
	if err != nil {
		return err
	}

	if err = UninstallKBFSServices(context, log); err != nil {
		log.Debug("unable to uninstall kbfs %s", err)
	}
	log.Debug("Installing KBFS (%s, timeout=%s)", label, timeout)
	if _, err := installKBFSService(context, kbfsService, plist, timeout, log); err != nil {
		log.Errorf("error installing KBFS: %s", err)
		pid, err := fallbackStartProcessAndWaitForInfo(context, kbfsService, plist, context.GetKBFSInfoPath(), timeout, log)
		if err != nil {
			return err
		}
		log.Debug("fallback KBFS service started, pid=%d", pid)
		return nil
	}

	log.Debug("KBFS installed via launchd successfully")
	return nil
}

// legacyCLIPathsFile is written instead of the links when /usr/local/bin is
// not a directory, as the old helper did. cliPathsDir is its directory's real
// path.
const (
	legacyCLIPathsFile = "/etc/paths.d/Keybase"
	cliPathsDir        = "/private/etc/paths.d"
)

// cliAppBundle is the only app clipaths links the command line tools from.
const cliAppBundle = "/Applications/Keybase.app"

// cliLinkDir is where clipaths links the command line tools.
const cliLinkDir = "/usr/local/bin"

// cliBinNames are the command line tools clipaths links, by name.
var cliBinNames = []string{"keybase", "git-remote-keybase"}

// cliLinks returns, for each of cliBinNames, its binary in cliAppBundle and
// its link in cliLinkDir.
func cliLinks() (bins []string, links []string) {
	binDir := filepath.Join(cliAppBundle, "Contents/SharedSupport/bin")
	for _, name := range cliBinNames {
		bins = append(bins, filepath.Join(binDir, name))
		links = append(links, filepath.Join(cliLinkDir, name))
	}
	return bins, links
}

// cliLink is a link named name in cliLinkDir, pointing at target.
type cliLink struct {
	name, target string
}

// inDirCommand returns the shell command that runs cmds, joined with &&, in
// dir, only when dir is that directory itself and not a link to another one.
// cmds name entries of dir by relative path.
func inDirCommand(dir string, cmds []string) string {
	q := adminprompt.ShellQuote(dir)
	return "cd -P " + q + " && /bin/test \"$(/bin/pwd -P)\" = " + q + " && " + strings.Join(cmds, " && ")
}

// installCLIPathsCommand returns the shell command that links each of
// cliBinNames in linkDir to the binary at the same index in bins. ln -h and
// -F make it replace a symlink or an empty directory at that exact name
// rather than create the link inside the directory either points at.
func installCLIPathsCommand(linkDir string, bins []string) string {
	cmds := make([]string, 0, len(cliBinNames))
	for i, name := range cliBinNames {
		cmds = append(cmds, "/bin/ln -sfhF "+adminprompt.ShellQuote(bins[i])+" "+adminprompt.ShellQuote(name))
	}
	return inDirCommand(linkDir, cmds)
}

// installCLIPathsFileCommand returns the shell command that writes binDir as
// the only line of a new file named name in pathsDir, creating pathsDir if it
// is missing.
func installCLIPathsFileCommand(pathsDir, name, binDir string) string {
	q := adminprompt.ShellQuote
	n := q(name)
	return "{ /bin/test -d " + q(pathsDir) + " || /bin/mkdir " + q(pathsDir) + "; } && " +
		inDirCommand(pathsDir, []string{"/bin/rm -f " + n, "set -C", "/usr/bin/printf '%s\\n' " + q(binDir) + " > " + n})
}

// uninstallCLIPathsCommand returns the shell command that removes each
// entry of linkDir named in links that is still a link to the given target,
// then pathsFile when it is not empty.
func uninstallCLIPathsCommand(linkDir string, links []cliLink, pathsFile string) string {
	var parts []string
	if len(links) > 0 {
		cmds := make([]string, 0, len(links))
		for _, l := range links {
			name := adminprompt.ShellQuote(l.name)
			cmds = append(cmds, "if /bin/test \"$(/usr/bin/readlink "+name+")\" = "+adminprompt.ShellQuote(l.target)+"; then /bin/rm -f "+name+"; fi")
		}
		parts = append(parts, "("+inDirCommand(linkDir, cmds)+")")
	}
	if pathsFile != "" {
		parts = append(parts, "/bin/rm -f "+adminprompt.ShellQuote(pathsFile))
	}
	return strings.Join(parts, " && ")
}

func runAdminPrompt(prompt, shellCmd string, log Log) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	out, err := adminprompt.Run(ctx, prompt, shellCmd)
	log.Debug("Administrator prompt output: %s", out)
	return err
}

// installCommandLinePrivileged links the command line tools of the app in
// /Applications into /usr/local/bin as root, after one administrator prompt.
func installCommandLinePrivileged(log Log) error {
	bins, links := cliLinks()
	for _, bin := range bins {
		fi, err := os.Lstat(bin)
		if err != nil {
			return fmt.Errorf("the command line tool can only be installed from %s: %w", cliAppBundle, err)
		}
		if !fi.Mode().IsRegular() {
			return fmt.Errorf("%s is not a regular file", bin)
		}
	}
	if fi, err := os.Lstat(cliLinkDir); err != nil || !fi.IsDir() {
		binDir := filepath.Dir(bins[0])
		log.Info("%s is not a directory; adding %s to %s as an administrator", cliLinkDir, binDir, legacyCLIPathsFile)
		return runAdminPrompt("Keybase wants to install the keybase command line tool.",
			installCLIPathsFileCommand(cliPathsDir, filepath.Base(legacyCLIPathsFile), binDir), log)
	}
	log.Info("Linking %v to %v as an administrator", links, bins)
	return runAdminPrompt("Keybase wants to install the keybase command line tool.", installCLIPathsCommand(cliLinkDir, bins), log)
}

// uninstallCommandLinePrivileged removes the CLI links that point into the
// app in /Applications and the old helper's paths.d entry. What the user can
// remove themselves is removed without a prompt; the rest takes one prompt.
func uninstallCommandLinePrivileged(log Log) error {
	bins, links := cliLinks()
	var privileged []cliLink
	for i, link := range links {
		if target, err := os.Readlink(link); err != nil || target != bins[i] {
			continue
		}
		if err := os.Remove(link); err == nil {
			log.Info("Removed %s", link)
			continue
		}
		privileged = append(privileged, cliLink{name: cliBinNames[i], target: bins[i]})
	}
	pathsFile := ""
	if pathExists(legacyCLIPathsFile) {
		pathsFile = legacyCLIPathsFile
	}
	if len(privileged) == 0 && pathsFile == "" {
		return nil
	}
	log.Info("Removing %v from %s and %q as an administrator", privileged, cliLinkDir, pathsFile)
	return runAdminPrompt("Keybase wants to remove the keybase command line tool.", uninstallCLIPathsCommand(cliLinkDir, privileged, pathsFile), log)
}

func uninstallCommandLine(log Log) error {
	linkPath, err := defaultLinkPath()
	if err != nil {
		return nil
	}

	err = uninstallLink(linkPath, log)
	if err != nil {
		return err
	}

	// Now the git binary.
	gitBinFilename := "git-remote-keybase"
	gitLinkPath := filepath.Join(filepath.Dir(linkPath), gitBinFilename)
	return uninstallLink(gitLinkPath, log)
}

// Uninstall uninstalls all keybase services
func Uninstall(context Context, components []string, log Log) keybase1.UninstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	log.Debug("Uninstalling components: %s", components)
	cleanupLegacyKBNM(log)

	if libkb.IsIn(string(ComponentNameRedirector), components, false) {
		err = libnativeinstaller.UninstallRedirector(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameRedirector), err))
		if err != nil {
			log.Errorf("Error stopping the redirector: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		var mountDir string
		mountDir, err = context.GetMountDir()
		if err == nil {
			err = UninstallKBFS(context, mountDir, true, log)
		}
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
		if err != nil {
			log.Errorf("Error uninstalling KBFS: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = UninstallKeybaseServices(context, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
		if err != nil {
			log.Errorf("Error uninstalling service: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = UninstallUpdaterService(context, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
		if err != nil {
			log.Errorf("Error uninstalling updater: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameMountDir), components, false) {
		err = libnativeinstaller.UninstallMountDir(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameMountDir), err))
		if err != nil {
			log.Errorf("Error uninstalling mount dir: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameFuse), components, false) {
		err = libnativeinstaller.UninstallFuse(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameFuse), err))
		if err != nil {
			log.Errorf("Error uninstalling fuse: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameApp), components, false) {
		componentResults = append(componentResults, appComponentResult(log))
	}

	if libkb.IsIn(string(ComponentNameCLIPaths), components, false) {
		err = uninstallCommandLinePrivileged(log)
		componentResults = append(componentResults, componentResult(string(ComponentNameCLIPaths), err))
		if err != nil {
			log.Errorf("Error uninstalling command line (privileged): %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameHelper), components, false) {
		err = libnativeinstaller.UninstallHelper(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameHelper), err))
		if err != nil {
			log.Errorf("Error uninstalling helper: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = uninstallCommandLine(log)
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
		if err != nil {
			log.Errorf("Error uninstalling command line: %s", err)
		}
	}

	return newUninstallResult(componentResults)
}

// UninstallKBFSOnStop removes KBFS services and unmounts and removes /keybase from the system
func UninstallKBFSOnStop(context Context, log Log) error {
	runMode := context.GetRunMode()
	mountDir, err := context.GetMountDir()
	if err != nil {
		return err
	}
	log.Info("UninstallKBFSOnStop: uninstalling from mountdir: %s", mountDir)

	if err := UninstallKBFS(context, mountDir, false, log); err != nil {
		return err
	}

	log.Info("Uninstalled mount: %s", mountDir)
	if err := libnativeinstaller.UninstallMountDir(runMode, log); err != nil {
		return fmt.Errorf("Error uninstalling mount: %s", err)
	}

	return nil
}

func unmount(mountDir string, forceUnmount bool, log Log) error {
	log.Debug("Checking if mounted: %s", mountDir)
	if _, serr := os.Stat(mountDir); os.IsNotExist(serr) {
		return nil
	}

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
	return nil
}

// UninstallKBFS uninstalls all KBFS services, unmounts and optionally removes the mount directory
func UninstallKBFS(context Context, mountDir string, forceUnmount bool, log Log) error {
	err := UninstallKBFSServices(context, log)
	if err != nil {
		log.Warning("Couldn't stop KBFS: %+v", err)
		// Continue despite the error, since the uninstall doesn't
		// seem to be resilient against the "fallback" PID getting out
		// of sync with the true KBFS PID.  TODO: fix the fallback PID
		// logic?
	}

	return unmount(mountDir, forceUnmount, log)
}

// AutoInstallWithStatus runs the auto install and returns a result
func AutoInstallWithStatus(context Context, binPath string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	_, res, err := autoInstall(context, binPath, force, timeout, log)
	if err != nil {
		return keybase1.InstallResult{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error())}
	}
	return newInstallResult(res)
}

// AutoInstall runs the auto install
func AutoInstall(context Context, binPath string, force bool, timeout time.Duration, log Log) (newProc bool, err error) {
	if context.GetRunMode() != libkb.ProductionRunMode {
		return false, fmt.Errorf("Auto install is only supported in production")
	}

	newProc, _, err = autoInstall(context, binPath, force, timeout, log)
	return
}

func autoInstall(context Context, binPath string, force bool, timeout time.Duration, log Log) (newProc bool, componentResults []keybase1.ComponentResult, err error) {
	log.Debug("+ AutoInstall for launchd")
	defer func() {
		log.Debug("- AutoInstall -> %v, %v", newProc, err)
	}()
	cleanupLegacyKBNM(log)
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

	err = InstallService(context, binPath, true, timeout, log)
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

// bundleDirForPath returns the Keybase.app bundle that contains p (the first
// path element named exactly Keybase.app), or "" if there is none.
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
		exitCode := 0
		if exitError, ok := err.(*exec.ExitError); ok {
			ws := exitError.Sys().(syscall.WaitStatus)
			exitCode = ws.ExitStatus()
		}
		return keybase1.ComponentResult{Name: name, Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error()), ExitCode: exitCode}
	}
	return keybase1.ComponentResult{Name: name, Status: keybase1.StatusOK("")}
}

// KBFSBinPath returns the path to the KBFS executable.
// If binPath (directory) is specified, it will override the default (which is in
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
	swver := strings.TrimSpace(string(out))
	// The version might not be semver compliant for beta macOS (e.g. "10.12")
	if strings.Count(swver, ".") == 1 {
		swver += ".0"
	}
	return semver.Make(swver)
}

// InstallUpdater installs the updater launchd service
func InstallUpdater(context Context, keybaseBinPath string, force bool, timeout time.Duration, log Log) error {
	if context.GetRunMode() != libkb.ProductionRunMode {
		return fmt.Errorf("Updater not supported in this run mode")
	}
	keybaseBinPath, err := chooseBinPath(keybaseBinPath)
	if err != nil {
		return err
	}
	updaterBinPath := filepath.Join(filepath.Dir(keybaseBinPath), "updater")
	log.Debug("Using updater path: %s", updaterBinPath)

	label := DefaultUpdaterLabel(context.GetRunMode())
	service := launchd.NewService(label)
	plist, err := updaterPlist(context, label, updaterBinPath, keybaseBinPath, log)
	if err != nil {
		return err
	}

	if err = UninstallUpdaterService(context, log); err != nil {
		log.Debug("unable uninstall updater service: %s", err)
	}
	log.Debug("Installing updater service (%s, timeout=%s)", label, timeout)
	if _, err := installUpdaterService(context, service, plist, timeout, log); err != nil {
		log.Errorf("Error installing updater service: %s", err)
		_, err = fallbackStartProcess(context, service, plist, log)
		return err
	}
	return nil
}

func updaterPlist(context Context, label string, serviceBinPath string, keybaseBinPath string, log Log) (launchd.Plist, error) {
	plistArgs := []string{fmt.Sprintf("-path-to-keybase=%s", keybaseBinPath)}
	envVars := DefaultLaunchdEnvVars(label)
	comment := "It's not advisable to edit this plist, it may be overwritten"
	logFile := filepath.Join(context.GetLogDir(), libkb.UpdaterLogFileName)
	err := libkb.MakeParentDirs(log, logFile)
	if err != nil {
		return launchd.Plist{}, err
	}
	return launchd.NewPlist(label, serviceBinPath, plistArgs, envVars, logFile, comment), nil
}

func installUpdaterService(context Context, service launchd.Service, plist launchd.Plist, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, wait, log)
	if err != nil {
		log.Warning("error installing updater service via launchd: %s", err)
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", wait, log)
	return &st, err
}

// UninstallUpdaterService removes updater launchd service
func UninstallUpdaterService(context Context, log Log) error {
	runMode := context.GetRunMode()
	pidFile := filepath.Join(context.GetCacheDir(), "updater.pid")
	err0 := fallbackKillProcess(context, log, DefaultUpdaterLabel(runMode), "", pidFile)
	err1 := launchd.Uninstall(DefaultUpdaterLabel(runMode), defaultLaunchdWait, log)
	return libkb.CombineErrors(err0, err1)
}

// kbfsBinName returns the name for the KBFS executable
func kbfsBinName() string {
	return "kbfs"
}

func updaterBinName() (string, error) {
	return "updater", nil
}

// RunApp starts the app
func RunApp(context Context, log Log) error {
	appPath, err := libnativeinstaller.AppBundleForPath()
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

// InstallLogPath doesn't exist on darwin as an independent log file (see desktop app log)
func InstallLogPath() (string, error) {
	return "", nil
}

// WatchdogLogPath doesn't exist on darwin as an independent log file (see desktop app log)
func WatchdogLogPath(string) (string, error) {
	return "", nil
}

// SystemLogPath is where privileged keybase processes log to on darwin
func SystemLogPath() string {
	return "/Library/Logs/keybase.system.log"
}

func fallbackPIDFilename(service launchd.Service) string {
	return filepath.Join(os.TempDir(), "kbfb."+service.Label())
}

func fallbackStartProcessAndWaitForInfo(context Context, service launchd.Service, plist launchd.Plist, infoPath string, timeout time.Duration, log Log) (int, error) {
	pid, err := fallbackStartProcess(context, service, plist, log)
	if err != nil {
		return 0, err
	}
	log.Debug("%s process started: %d, waiting for service info file %s to exist", service.Label(), pid, context.GetServiceInfoPath())
	spid := strconv.Itoa(pid)
	_, err = libkb.WaitForServiceInfoFile(infoPath, service.Label(), spid, timeout, log)
	if err != nil {
		log.Warning("error waiting for %s info file %s: %s", service.Label(), infoPath, err)
		return 0, err
	}
	log.Debug("%s info file %s exists, fallback service start worked", service.Label(), infoPath)
	return pid, nil
}

func fallbackStartProcess(context Context, service launchd.Service, plist launchd.Plist, log Log) (int, error) {
	log.Info("falling back to starting %s process manually", service.Label())

	cmd := plist.FallbackCommand()
	log.Info("fallback command: %s %v (env: %v)", cmd.Path, cmd.Args, cmd.Env)
	err := cmd.Start()
	if err != nil {
		log.Warning("error starting fallback command for %s (%s): %s", service.Label(), cmd.Path, err)
		return 0, err
	}

	if cmd.Process == nil {
		log.Warning("no process after starting command %s", cmd.Path)
		return 0, fmt.Errorf("failed to start %s (%s)", service.Label(), cmd.Path)
	}

	log.Info("fallback command started: %s, pid = %d", cmd.Path, cmd.Process.Pid)

	// save pid in a fallback file so uninstall can check
	f, err := os.Create(fallbackPIDFilename(service))
	if err != nil {
		log.Warning("failed to create fallback pid file %s: %s", fallbackPIDFilename(service), err)
	} else {
		if _, err := fmt.Fprintf(f, "%d", cmd.Process.Pid); err != nil {
			log.Warning("failed to write to fallback pid file %s: %s", fallbackPIDFilename(service), err)
		}
		f.Close()
	}

	return cmd.Process.Pid, nil
}

func fallbackKillProcess(context Context, log Log, label string, infoPath, pidPath string) error {
	svc := launchd.NewService(label)
	svc.SetLogger(log)

	fpid := fallbackPIDFilename(svc)

	exists, err := libkb.FileExists(fpid)
	if err != nil {
		return err
	}
	if !exists {
		log.Debug("no fallback pid file exists for %s (%s)", svc.Label(), fpid)
		return nil
	}

	log.Debug("fallback pid file exists for %s", svc.Label())
	p, err := os.ReadFile(fpid)
	if err != nil {
		return err
	}
	pid := string(bytes.TrimSpace(p))

	found := false
	if infoPath != "" {
		serviceInfo, err := libkb.LoadServiceInfo(infoPath)
		if err != nil {
			log.Warning("error loading service info for %s in file %s: %s", svc.Label(), infoPath, err)
			return err
		}
		if serviceInfo != nil {
			if strconv.Itoa(serviceInfo.Pid) != pid {
				log.Warning("service info pid %d does not match fallback pid %s, not killing anything", serviceInfo.Pid, pid)
				return errors.New("fallback PID mismatch")
			}
			found = true
		}
	}

	if !found && pidPath != "" {
		lp, err := os.ReadFile(pidPath)
		if err != nil {
			return err
		}
		lpid := string(bytes.TrimSpace(lp))
		if lpid != pid {
			log.Warning("pid in file %s (%d) does not match fallback pid %s, not killing anything", pidPath, lpid, pid)
			return errors.New("fallback PID mismatch")
		}
		found = true
	}

	if !found {
		log.Warning("neither infoPath or pidPath specified, cannot verify fallback PID.")
		return errors.New("unable to verify fallback PID")
	}

	log.Debug("stopping process %s for %s", pid, svc.Label())
	cmd := exec.Command("kill", pid)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Warning("error stopping process %s for %s: %s", pid, svc.Label(), err)
		log.Debug("command output: %s", out)
		return err
	}
	log.Debug("process %s for %s stopped", pid, svc.Label())
	if err := os.Remove(fpid); err != nil {
		log.Warning("error removing fallback pid file %s: %s", fpid, err)
		return err
	}
	log.Debug("fallback pid file %s for %s removed", fpid, svc.Label())

	return nil
}

// StartUpdateIfNeeded starts to update the app if there's one available. It
// calls `updater check` internally so it ignores the snooze.
func StartUpdateIfNeeded(ctx context.Context, log logger.Logger) error {
	updaterPath, err := UpdaterBinPath()
	if err != nil {
		return err
	}
	cmd := exec.Command(updaterPath, "check")
	// Run it in a new process group so when we are killed eventually by the
	// updater, we don't bring down the updater too.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err = cmd.Start(); err != nil {
		return err
	}
	pid := -1
	if cmd.Process != nil {
		pid = cmd.Process.Pid
	}
	log.Debug("Started background updater process (%s). pid=%d", updaterPath, pid)
	if err = cmd.Wait(); err != nil {
		log.Debug("updater cmd failed: %s", err)
	}
	// Ignore the exit status here as user may have hit "Ignore". If we are
	// here without getting killed, it's likely user has hit "Ignore". Just
	// just return `nil` and GUI would check for update info again where it'd
	// know we don't need to update anymore.
	return nil
}
