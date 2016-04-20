// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/blang/semver"
	"github.com/kardianos/osext"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/lsof"
	keybase1 "github.com/keybase/client/go/protocol"
)

type Context interface {
	GetCacheDir() string
	GetRuntimeDir() string
	GetRunMode() libkb.RunMode
}

type ComponentName string

const (
	ComponentNameCLI     ComponentName = "cli"
	ComponentNameService ComponentName = "service"
	ComponentNameKBFS    ComponentName = "kbfs"
	ComponentNameUpdater ComponentName = "updater"
	ComponentNameUnknown ComponentName = "unknown"
)

var ComponentNames = []ComponentName{ComponentNameCLI, ComponentNameService, ComponentNameKBFS, ComponentNameUpdater}

func (c ComponentName) String() string {
	switch c {
	case ComponentNameCLI:
		return "Command Line"
	case ComponentNameService:
		return "Service"
	case ComponentNameKBFS:
		return "KBFS"
	case ComponentNameUpdater:
		return "Updater"
	}
	return "Unknown"
}

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
	}
	return ComponentNameUnknown
}

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

func KBFSBundleVersion(context Context, binPath string) (string, error) {
	runMode := context.GetRunMode()
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

func createCommandLine(binPath string, linkPath string) error {
	if _, err := os.Lstat(linkPath); err == nil {
		err := os.Remove(linkPath)
		if err != nil {
			return err
		}
	}

	return os.Symlink(binPath, linkPath)
}

func uninstallCommandLine() error {
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

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return binPath()
}

func binPath() (string, error) {
	return osext.Executable()
}

func binName() string {
	return filepath.Base(os.Args[0])
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

func kbfsBinPathDefault(runMode libkb.RunMode, binPath string) (string, error) {
	path, err := chooseBinPath(binPath)
	if err != nil {
		return "", err
	}
	kbfsBinName := kbfsBinName(runMode)
	return filepath.Join(filepath.Dir(path), kbfsBinName), nil
}

// IsInUse returns true if the mount is in use. This may be used by the updater
// to determine if it's safe to apply an update and restart.
func IsInUse(mountDir string, log logger.Logger) bool {
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
