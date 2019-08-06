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

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/utils"
)

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// Context is the environment for this package
type Context interface {
	GetConfigDir() string
	GetCacheDir() string
	GetRuntimeDir() string
	GetMountDir() (string, error)
	GetLogDir() string
	GetRunMode() libkb.RunMode
	GetServiceInfoPath() string
	GetKBFSInfoPath() string
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
	// ComponentNameKBNM is the Keybase NativeMessaging client component
	ComponentNameKBNM ComponentName = "kbnm"
	// ComponentNameUpdater is the updater component
	ComponentNameUpdater ComponentName = "updater"
	// ComponentNameApp is the UI app
	ComponentNameApp ComponentName = "app"
	// ComponentNameFuse is the Fuse component
	ComponentNameFuse ComponentName = "fuse"
	// ComponentNameHelper is the privileged helper tool
	ComponentNameHelper ComponentName = "helper"
	// ComponentNameMountDir is the mount directory
	ComponentNameMountDir ComponentName = "mountdir"
	// ComponentNameCLIPaths is for /etc/paths.d/Keybase
	ComponentNameCLIPaths ComponentName = "clipaths"
	// ComponentNameRedirector is the KBFS redirector
	ComponentNameRedirector ComponentName = "redirector"
	// ComponentNameUnknown is placeholder for unknown components
	ComponentNameUnknown ComponentName = "unknown"
)

// ComponentNames are all the valid component names
var ComponentNames = []ComponentName{ComponentNameCLI, ComponentNameService, ComponentNameKBFS, ComponentNameUpdater, ComponentNameFuse, ComponentNameHelper, ComponentNameApp, ComponentNameKBNM, ComponentNameRedirector, ComponentNameCLIPaths}

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
	case ComponentNameFuse:
		return "Fuse"
	case ComponentNameHelper:
		return "Privileged Helper Tool"
	case ComponentNameKBNM:
		return "Browser Native Messaging"
	case ComponentNameCLIPaths:
		return "Command Line (privileged)"
	case ComponentNameRedirector:
		return "Redirector (privileged)"
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
	case string(ComponentNameKBNM):
		return ComponentNameKBNM
	case string(ComponentNameUpdater):
		return ComponentNameUpdater
	case string(ComponentNameApp):
		return ComponentNameApp
	case string(ComponentNameFuse):
		return ComponentNameFuse
	case string(ComponentNameHelper):
		return ComponentNameHelper
	case string(ComponentNameCLIPaths):
		return ComponentNameCLIPaths
	case string(ComponentNameRedirector):
		return ComponentNameRedirector
	}
	return ComponentNameUnknown
}

// ResolveInstallStatus will determine necessary install actions for the current environment
func ResolveInstallStatus(version string, bundleVersion string, lastExitStatus string, log Log) (installStatus keybase1.InstallStatus, installAction keybase1.InstallAction, status keybase1.Status) {
	installStatus = keybase1.InstallStatus_UNKNOWN
	installAction = keybase1.InstallAction_UNKNOWN
	switch {
	case version != "" && bundleVersion != "":
		sv, err := semver.Make(version)
		if err != nil {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_REINSTALL
			status = keybase1.StatusFromCode(keybase1.StatusCode_SCInvalidVersionError, err.Error())
			return
		}
		bsv, err := semver.Make(bundleVersion)
		// Invalid bundle version
		if err != nil {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_NONE
			status = keybase1.StatusFromCode(keybase1.StatusCode_SCInvalidVersionError, err.Error())
			return
		}
		switch {
		case bsv.GT(sv):
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_UPGRADE
		case bsv.EQ(sv):
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_NONE
		case bsv.LT(sv):
			// It's ok if we have a bundled version less than what was installed
			log.Warning("Bundle version (%s) is less than installed version (%s)", bundleVersion, version)
			installStatus = keybase1.InstallStatus_INSTALLED
			installAction = keybase1.InstallAction_NONE
		}
	case version != "" && bundleVersion == "":
		installStatus = keybase1.InstallStatus_INSTALLED
	case version == "" && bundleVersion != "":
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

func createCommandLine(binPath string, linkPath string, log Log) error { //nolint
	if _, err := os.Lstat(linkPath); err == nil {
		err := os.Remove(linkPath)
		if err != nil {
			return err
		}
	}

	log.Info("Linking %s to %s", linkPath, binPath)
	return os.Symlink(binPath, linkPath)
}

func defaultLinkPath() (string, error) { //nolint
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

func uninstallLink(linkPath string, log Log) error { //nolint
	log.Debug("Link path: %s", linkPath)
	fi, err := os.Lstat(linkPath)
	if os.IsNotExist(err) {
		log.Debug("Path doesn't exist: %s", linkPath)
		return nil
	}
	isLink := (fi.Mode()&os.ModeSymlink != 0)
	if !isLink {
		return fmt.Errorf("Path is not a symlink: %s", linkPath)
	}
	log.Info("Removing %s", linkPath)
	return os.Remove(linkPath)
}

func uninstallCommandLine(log Log) error { //nolint
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

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return BinPath()
}

// BinPath returns path to the keybase executable. If the executable path is a
// symlink, the target path is returned.
func BinPath() (string, error) {
	return utils.BinPath()
}

func binName() (string, error) { //nolint
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
// If binPath (directory) is specified, it will override the default (which is in
// the same directory where the keybase executable is).
func kbfsBinPathDefault(runMode libkb.RunMode, binPath string) (string, error) {
	path, err := chooseBinPath(binPath)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), kbfsBinName()), nil
}

type CommonLsofResult struct {
	PID     string
	Command string
}
