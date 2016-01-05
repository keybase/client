// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
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
	ComponentNameUnknown ComponentName = "unknown"
)

var ComponentNames = []ComponentName{ComponentNameCLI, ComponentNameService, ComponentNameKBFS}

func (c ComponentName) String() string {
	switch c {
	case ComponentNameCLI:
		return "Command Line"
	case ComponentNameService:
		return "Service"
	case ComponentNameKBFS:
		return "KBFS"
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
			status = errorStatus("INSTALL_ERROR", err.Error())
			return
		}
		bsv, err := semver.Make(bundleVersion)
		// Invalid bundle bersion
		if err != nil {
			installStatus = keybase1.InstallStatus_ERROR
			installAction = keybase1.InstallAction_NONE
			status = errorStatus("INSTALL_ERROR", err.Error())
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
			status = errorStatus("INSTALL_ERROR", fmt.Sprintf("Bundle version (%s) is less than installed version (%s)", bundleVersion, version))
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

	status = keybase1.Status{Name: "OK"}
	return
}

func errorStatus(name string, desc string) keybase1.Status {
	return keybase1.Status{Code: libkb.SCGeneric, Name: name, Desc: desc}
}

func ErrorStatus(name string, desc string) keybase1.Status {
	return errorStatus(name, desc)
}

func serviceInfoPath(context Context) string {
	return path.Join(context.GetRuntimeDir(), "keybased.info")
}

func kbfsBundleVersion(context Context, binPath string) (string, error) {
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

// We're only moving the folder in case something somehow managed to get at it
// in between unmounting and checking if it had files.
func trashDir(context Context, dir string) error {
	randString, err := libkb.RandString("Trash.", 20)
	if err != nil {
		return err
	}
	return os.Rename(dir, filepath.Join(context.GetCacheDir(), randString))
}

func chooseBinPath(bp string) (string, error) {
	if bp != "" {
		return bp, nil
	}
	return binPath()
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

func brewPath(formula string) (string, error) {
	// Get the homebrew install path prefix for this formula
	prefixOutput, err := exec.Command("brew", "--prefix", formula).Output()
	if err != nil {
		return "", fmt.Errorf("Error checking brew path: %s", err)
	}
	prefix := strings.TrimSpace(string(prefixOutput))
	return prefix, nil
}
