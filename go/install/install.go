// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/kardianos/osext"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/lsof"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-updater/process"
)

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// Context is the enviroment for this package
type Context interface {
	GetConfigDir() string
	GetCacheDir() string
	GetRuntimeDir() string
	GetMountDir() (string, error)
	GetLogDir() string
	GetRunMode() libkb.RunMode
	GetServiceInfoPath() string
	GetKBFSInfoPath() string
	GetAppStartMode() (libkb.AppStartMode, error)
}

// ComponentName defines a component name
type ComponentName string

const (
	// ComponentNameCLI is the command line component
	ComponentNameCLI ComponentName = "cli"
	// ComponentNameService is the service component
	ComponentNameService ComponentName = "service"
	// ComponentNameKBFS is the KBFS component
	ComponentNameKBFS ComponentName = "kbfs"
	// ComponentNameUpdater is the updater component
	ComponentNameUpdater ComponentName = "updater"
	// ComponentNameApp is the UI app
	ComponentNameApp ComponentName = "app"
	// ComponentNameUnknown is placeholder for unknown components
	ComponentNameUnknown ComponentName = "unknown"
)

// ComponentNames are all the valid component names
var ComponentNames = []ComponentName{ComponentNameCLI, ComponentNameService, ComponentNameKBFS, ComponentNameUpdater}

// String returns string for ComponentName
func (c ComponentName) String() string {
	return string(c)
}

// Description returns description for component name
func (c ComponentName) Description() string {
	switch c {
	case ComponentNameService:
		return "Service"
	case ComponentNameKBFS:
		return "KBFS"
	case ComponentNameApp:
		return "App"
	case ComponentNameCLI:
		return "Command Line"
	case ComponentNameUpdater:
		return "Updater"
	}
	return "Unknown"
}

// ComponentNameFromString returns ComponentName from a string
func ComponentNameFromString(s string) ComponentName {
	switch s {
	case string(ComponentNameCLI):
		return ComponentNameCLI
	case string(ComponentNameService):
		return ComponentNameService
	case string(ComponentNameKBFS):
		return ComponentNameKBFS
	case string(ComponentNameUpdater):
		return ComponentNameUpdater
	case string(ComponentNameApp):
		return ComponentNameApp
	}
	return ComponentNameUnknown
}

// ResolveInstallStatus will determine necessary install actions for the current environment
func ResolveInstallStatus(version string, bundleVersion string, lastExitStatus string) (installStatus keybase1.InstallStatus, installAction keybase1.InstallAction, status keybase1.Status) {
	installStatus = keybase1.InstallStatus_UNKNOWN
	installAction = keybase1.InstallAction_UNKNOWN
	if version != "" && bundleVersion != "" {
		sv, err := semver.Make(version)
		if err != nil {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_REINSTALL
			status = keybase1.StatusFromCode(keybase1.StatusCode_SCInvalidVersionError, err.Error())
			return
		}
		bsv, err := semver.Make(bundleVersion)
		// Invalid bundle bersion
		if err != nil {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_NONE
			status = keybase1.StatusFromCode(keybase1.StatusCode_SCInvalidVersionError, err.Error())
			return
		}
		if bsv.GT(sv) {
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_UPGRADE
		} else if bsv.EQ(sv) {
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_NONE
		} else if bsv.LT(sv) {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_NONE
			status = keybase1.StatusFromCode(keybase1.StatusCode_SCOldVersionError, fmt.Sprintf("Bundle version (%s) is less than installed version (%s)", bundleVersion, version))
			return
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

	status = keybase1.StatusOK("")
	return
}

// KBFSBundleVersion returns the bundle (not installed) version for KBFS
func KBFSBundleVersion(context Context, binPath string) (string, error) {
	runMode := context.GetRunMode()
	kbfsBinPath, err := KBFSBinPath(runMode, binPath)
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

func createCommandLine(binPath string, linkPath string) error {
	if _, err := os.Lstat(linkPath); err == nil {
		err := os.Remove(linkPath)
		if err != nil {
			return err
		}
	}

	return os.Symlink(binPath, linkPath)
}

func defaultLinkPath() (string, error) {
	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("Unsupported on Windows")
	}
	keybaseName, err := binName()
	if err != nil {
		return "", err
	}
	linkPath := filepath.Join("/usr/local/bin", keybaseName)
	return linkPath, nil
}

func uninstallCommandLine() error {
	linkPath, err := defaultLinkPath()

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

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return BinPath()
}

// BinPath returns path to the keybase executable
func BinPath() (string, error) {
	return osext.Executable()
}

func binName() (string, error) {
	path, err := BinPath()
	if err != nil {
		return "", err
	}
	return filepath.Base(path), nil
}

// UpdaterBinPath returns the path to the updater executable, by default is in
// the same directory as the keybase executable.
func UpdaterBinPath() (string, error) {
	path, err := BinPath()
	if err != nil {
		return "", err
	}
	name, err := updaterBinName()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), name), nil
}

// kbfsBinPathDefault returns the default path to the KBFS executable.
// If binPath (directory) is specifed, it will override the default (which is in
// the same directory where the keybase executable is).
func kbfsBinPathDefault(runMode libkb.RunMode, binPath string) (string, error) {
	path, err := chooseBinPath(binPath)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), kbfsBinName()), nil
}

// IsInUse returns true if the mount is in use. This may be used by the updater
// to determine if it's safe to apply an update and restart.
func IsInUse(mountDir string, log Log) bool {
	log.Debug("Mount dir: %s", mountDir)
	if mountDir == "" {
		return false
	}
	if _, serr := os.Stat(mountDir); os.IsNotExist(serr) {
		log.Debug("%s doesn't exist", mountDir)
		return false
	}

	log.Debug("Checking mount (lsof)")
	processes, err := lsof.MountPoint(mountDir)
	if err != nil {
		// If there is an error in lsof it's ok to continue
		log.Warning("Continuing despite error in lsof: %s", err)
	}
	if len(processes) != 0 {
		return true
	}
	return false
}

// TerminateApp will stop the Keybase (UI) app
func TerminateApp(context Context, log Log) error {
	appExecName := "Keybase"
	logf := logger.NewLoggerf(log)
	log.Info("Stopping Keybase app")
	appPIDs := process.TerminateAll(process.NewMatcher(appExecName, process.ExecutableEqual, logf), 5*time.Second, logf)
	if len(appPIDs) > 0 {
		log.Info("Terminated %s %v", appExecName, appPIDs)
	}
	return nil
}
