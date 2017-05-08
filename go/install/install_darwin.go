// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/user"
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
	err := libkb.MakeParentDirs(startLogFile)
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
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, context.GetServiceInfoPath(), wait, log)
	return &st, err
}

// UninstallKeybaseServices removes the keybase service (includes homebrew)
func UninstallKeybaseServices(runMode libkb.RunMode, log Log) error {
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

func installKBFSService(context Context, service launchd.Service, plist launchd.Plist, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, wait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", wait, log)
	return &st, err
}

// UninstallKBFSServices removes KBFS service (including homebrew)
func UninstallKBFSServices(runMode libkb.RunMode, log Log) error {
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

// Install installs specified components
func Install(context Context, binPath string, sourcePath string, components []string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	var err error
	componentResults := []keybase1.ComponentResult{}

	log.Debug("Installing components: %s", components)

	if libkb.IsIn(string(ComponentNameApp), components, false) {
		err = installAppBundle(context, sourcePath, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameApp), err))
		if err != nil {
			log.Errorf("Error installing app bundle: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = InstallUpdater(context, binPath, force, timeout, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
		if err != nil {
			log.Errorf("Error installing updater: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = installCommandLine(context, binPath, true, log) // Always force CLI install
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
		if err != nil {
			log.Errorf("Error installing CLI: %s", err)
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
		err = installFuse(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameFuse), err))
		if err != nil {
			log.Errorf("Error installing KBFuse: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameMountDir), components, false) {
		err = installMountDir(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameMountDir), err))
		if err != nil {
			log.Errorf("Error installing mount directory: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		err = InstallKBFS(context, binPath, force, timeout, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
		if err != nil {
			log.Errorf("Error installing KBFS: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameKBNM), components, false) {
		err = InstallKBNM(context, binPath, log)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBNM), err))
		if err != nil {
			log.Errorf("Error installing KBNM: %s", err)
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
	log.Debug("Checking %s (%s)", linkPath, bp)
	err = installCommandLineForBinPath(bp, linkPath, force, log)
	if err != nil {
		log.Errorf("Command line not installed properly (%s)", err)
		return err
	}

	return nil
}

func installCommandLineForBinPath(binPath string, linkPath string, force bool, log Log) error {
	fi, err := os.Lstat(linkPath)
	if os.IsNotExist(err) {
		// Doesn't exist, create
		return createCommandLine(binPath, linkPath, log)
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
	UninstallKeybaseServices(context.GetRunMode(), log)
	log.Debug("Installing service (%s, timeout=%s)", label, timeout)
	if _, err := installKeybaseService(context, service, plist, timeout, log); err != nil {
		log.Errorf("Error installing Keybase service: %s", err)
		return err
	}
	return nil
}

// InstallKBFS installs the KBFS launchd service
func InstallKBFS(context Context, binPath string, force bool, timeout time.Duration, log Log) error {
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

	UninstallKBFSServices(context.GetRunMode(), log)
	log.Debug("Installing KBFS (%s, timeout=%s)", label, timeout)
	if _, err := installKBFSService(context, kbfsService, plist, timeout, log); err != nil {
		log.Errorf("Error installing KBFS: %s", err)
		return err
	}
	return nil
}

// kbnmManifestPath returns where the NativeMessaging host manifest lives on
// this platform. Will return paths for both Chrome and Chromium.
func kbnmManifestPaths(u *user.User) []string {
	// Paths per https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host-location-nix

	if u.Uid == "0" {
		// Installing as root
		return []string{
			"/Library/Google/Chrome/NativeMessagingHosts",
			"/Library/Application Support/Chromium/NativeMessagingHosts",
		}
	}

	// Install as local user
	return []string{
		filepath.Join(u.HomeDir, "Library/Application Support/Google/Chrome/NativeMessagingHosts"),
		filepath.Join(u.HomeDir, "Library/Application Support/Chromium/NativeMessagingHosts"),
	}
}

// kbnmWrapError adds additional instructions to errors when possible.
func kbnmWrapError(err error, u *user.User, hostsPath string) error {
	if !os.IsPermission(err) {
		return err
	}
	return fmt.Errorf("%s: Make sure the directory is owned by %s. "+
		"You can run:\n "+
		"  sudo chown -R %s:staff %q", err, u.Username, u.Username, hostsPath)
}

// kbnmHostName is the name of the NativeMessage host that the extension communicates with.
const kbnmHostName = "io.keybase.kbnm"

// kbnmDescription is the description of the purpose for the manifest whitelist.
const kbnmDescription = "Keybase Native Messaging API"

// InstallKBNM installs the Keybase NativeMessaging whitelist
func InstallKBNM(context Context, binPath string, log Log) error {
	// Find path of the keybase binary
	keybasePath, err := chooseBinPath(binPath)
	if err != nil {
		return err
	}
	// kbnm binary is next to the keybase binary, same dir
	hostPath := filepath.Join(filepath.Dir(keybasePath), "kbnm")

	// Host manifest, see: https://developer.chrome.com/extensions/nativeMessaging
	hostManifest := struct {
		Name           string   `json:"name"`
		Description    string   `json:"description"`
		Path           string   `json:"path"`
		Type           string   `json:"type"`
		AllowedOrigins []string `json:"allowed_origins"`
	}{
		Name:        kbnmHostName,
		Description: kbnmDescription,
		Path:        hostPath,
		Type:        "stdio",
		AllowedOrigins: []string{
			// Production public version in the store
			"chrome-extension://ognfafcpbkogffpmmdglhbjboeojlefj/",
			// Hard-coded key from the repo version
			"chrome-extension://kockbbfoibcdfibclaojljblnhpnjndg/",
			// Keybase-internal version
			"chrome-extension://gnjkbjlgkpiaehpibpdefaieklbfljjm/",
		},
	}

	u, err := user.Current()
	if err != nil {
		return err
	}

	hostsPaths := kbnmManifestPaths(u)
	for _, hostsPath := range hostsPaths {
		jsonPath := filepath.Join(hostsPath, kbnmHostName+".json")

		// Make the path if it doesn't exist
		if err := os.MkdirAll(hostsPath, os.ModePerm); err != nil {
			return kbnmWrapError(err, u, hostsPath)
		}

		// Write the file
		log.Debug("Installing KBNM host manifest: %s", jsonPath)
		fp, err := os.OpenFile(jsonPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
		if err != nil {
			return kbnmWrapError(err, u, hostsPath)
		}
		defer fp.Close()

		encoder := json.NewEncoder(fp)
		encoder.SetIndent("", "    ")
		if err := encoder.Encode(&hostManifest); err != nil {
			return kbnmWrapError(err, u, hostsPath)
		}
	}
	return nil
}

// UninstallKBNM removes the Keybase NativeMessaging whitelist
func UninstallKBNM(log Log) error {
	u, err := user.Current()
	if err != nil {
		return err
	}

	hostsPaths := kbnmManifestPaths(u)
	for _, hostsPath := range hostsPaths {
		jsonPath := filepath.Join(hostsPath, kbnmHostName+".json")

		log.Info("Uninstalling KBNM host manifest: %s", jsonPath)
		if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
			// We don't care if it doesn't exist, but other errors should escalate
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

	if libkb.IsIn(string(ComponentNameKBFS), components, false) {
		var mountDir string
		mountDir, err = context.GetMountDir()
		if err == nil {
			err = UninstallKBFS(context.GetRunMode(), mountDir, true, log)
		}
		componentResults = append(componentResults, componentResult(string(ComponentNameKBFS), err))
		if err != nil {
			log.Errorf("Error uninstalling KBFS: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameService), components, false) {
		err = UninstallKeybaseServices(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameService), err))
		if err != nil {
			log.Errorf("Error uninstalling service: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameUpdater), components, false) {
		err = UninstallUpdaterService(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameUpdater), err))
		if err != nil {
			log.Errorf("Error uninstalling updater: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameMountDir), components, false) {
		err = uninstallMountDir(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameMountDir), err))
		if err != nil {
			log.Errorf("Error uninstalling mount dir: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameFuse), components, false) {
		err = uninstallFuse(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameFuse), err))
		if err != nil {
			log.Errorf("Error uninstalling fuse: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameHelper), components, false) {
		err = uninstallHelper(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameHelper), err))
		if err != nil {
			log.Errorf("Error uninstalling helper: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameApp), components, false) {
		err = uninstallApp(context.GetRunMode(), log)
		componentResults = append(componentResults, componentResult(string(ComponentNameApp), err))
		if err != nil {
			log.Errorf("Error uninstalling app: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameCLI), components, false) {
		err = uninstallCommandLine(log)
		componentResults = append(componentResults, componentResult(string(ComponentNameCLI), err))
		if err != nil {
			log.Errorf("Error uninstalling command line: %s", err)
		}
	}

	if libkb.IsIn(string(ComponentNameKBNM), components, false) {
		err = UninstallKBNM(log)
		componentResults = append(componentResults, componentResult(string(ComponentNameKBNM), err))
		if err != nil {
			log.Errorf("Error uninstalling kbmn: %s", err)
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

	if err := UninstallKBFS(runMode, mountDir, false, log); err != nil {
		return err
	}

	log.Info("Uninstall mount: %s", mountDir)
	if err := uninstallMountDir(runMode, log); err != nil {
		return fmt.Errorf("Error uninstalling mount: %s", err)
	}

	return nil
}

// UninstallKBFS uninstalls all KBFS services, unmounts and optionally removes the mount directory
func UninstallKBFS(runMode libkb.RunMode, mountDir string, forceUnmount bool, log Log) error {
	err := UninstallKBFSServices(runMode, log)
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

	return nil
}

func nativeInstallerAppBundlePath(appPath string) string {
	return filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app")
}

func nativeInstallerAppBundleExecPath(appPath string) string {
	return filepath.Join(nativeInstallerAppBundlePath(appPath), "Contents/MacOS/Keybase")
}

func uninstallMountDir(runMode libkb.RunMode, log Log) error {
	// We need the installer to remove the mount directory (since it's in the root, only the helper tool can do it)
	return execNativeInstallerWithArg([]string{"--uninstall-mountdir"}, runMode, log)
}

func uninstallFuse(runMode libkb.RunMode, log Log) error {
	log.Info("Removing KBFuse")
	return execNativeInstallerWithArg([]string{"--uninstall-fuse"}, runMode, log)
}

func uninstallHelper(runMode libkb.RunMode, log Log) error {
	log.Info("Removing privileged helper tool")
	return execNativeInstallerWithArg([]string{"--uninstall-helper"}, runMode, log)
}

func uninstallApp(runMode libkb.RunMode, log Log) error {
	log.Info("Removing app")
	return execNativeInstallerWithArg([]string{"--uninstall-app"}, runMode, log)
}

func installMountDir(runMode libkb.RunMode, log Log) error {
	log.Info("Creating mount directory")
	return execNativeInstallerWithArg([]string{"--install-mountdir"}, runMode, log)
}

func installFuse(runMode libkb.RunMode, log Log) error {
	log.Info("Installing KBFuse")
	return execNativeInstallerWithArg([]string{"--install-fuse"}, runMode, log)
}

func installAppBundle(context Context, sourcePath string, log Log) error {
	log.Info("Install app bundle")
	return execNativeInstallerWithArg([]string{"--install-app-bundle", fmt.Sprintf("--source-path=%s", sourcePath)}, context.GetRunMode(), log)
}

func execNativeInstallerWithArg(args []string, runMode libkb.RunMode, log Log) error {
	appPath, err := AppBundleForPath()
	if err != nil {
		return err
	}
	includeArgs := []string{"--debug", fmt.Sprintf("--run-mode=%s", runMode), fmt.Sprintf("--app-path=%s", appPath), fmt.Sprintf("--timeout=10")}
	args = append(includeArgs, args...)
	cmd := exec.Command(nativeInstallerAppBundleExecPath(appPath), args...)
	output, err := cmd.CombinedOutput()
	log.Debug("Output (%s): %s", args, string(output))
	return err
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
	swver := strings.TrimSpace(string(out))
	// The version might not be semver compliant for beta macOS (e.g. "10.12")
	if strings.Count(swver, ".") == 1 {
		swver = swver + ".0"
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

	UninstallUpdaterService(context.GetRunMode(), log)
	log.Debug("Installing updater service (%s, timeout=%s)", label, timeout)
	if _, err := installUpdaterService(service, plist, timeout, log); err != nil {
		log.Errorf("Error installing updater service: %s", err)
		return err
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

func installUpdaterService(service launchd.Service, plist launchd.Plist, wait time.Duration, log Log) (*keybase1.ServiceStatus, error) {
	err := launchd.Install(plist, wait, log)
	if err != nil {
		return nil, err
	}

	st, err := serviceStatusFromLaunchd(service, "", wait, log)
	return &st, err
}

// UninstallUpdaterService removes updater launchd service
func UninstallUpdaterService(runMode libkb.RunMode, log Log) error {
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

// InstallLogPath doesn't exist on darwin as an independent log file (see desktop app log)
func InstallLogPath() (string, error) {
	return "", nil
}

// SystemLogPath is where privileged keybase processes log to on darwin
func SystemLogPath() string {
	return "/Library/Logs/keybase.system.log"
}
