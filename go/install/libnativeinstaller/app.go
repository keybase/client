// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libnativeinstaller

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/kardianos/osext"
	"github.com/keybase/client/go/libkb"
)

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// Context is the enviroment for install package.
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

func nativeInstallerAppBundlePath(appPath string) string {
	return filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app")
}

func nativeInstallerAppBundleExecPath(appPath string) string {
	return filepath.Join(nativeInstallerAppBundlePath(appPath), "Contents/MacOS/Keybase")
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

// InstallMountDir calls the installer with --install-mountdir.
func InstallMountDir(runMode libkb.RunMode, log Log) error {
	log.Info("Creating mount directory")
	return execNativeInstallerWithArg([]string{"--install-mountdir"}, runMode, log)
}

// UninstallMountDir calls the installer with --uninstall-mountdir.
func UninstallMountDir(runMode libkb.RunMode, log Log) error {
	// We need the installer to remove the mount directory (since it's in the root, only the helper tool can do it)
	return execNativeInstallerWithArg([]string{"--uninstall-mountdir"}, runMode, log)
}

// InstallRedirector calls the installer with --install-redirector.
func InstallRedirector(runMode libkb.RunMode, log Log) error {
	log.Info("Starting redirector")
	return execNativeInstallerWithArg([]string{"--install-redirector"}, runMode, log)
}

// UninstallRedirector calls the installer with --uninstall-redirector.
func UninstallRedirector(runMode libkb.RunMode, log Log) error {
	return execNativeInstallerWithArg([]string{"--uninstall-redirector"}, runMode, log)
}

// InstallFuse calls the installer with --install-fuse.
func InstallFuse(runMode libkb.RunMode, log Log) error {
	log.Info("Installing KBFuse")
	return execNativeInstallerWithArg([]string{"--install-fuse"}, runMode, log)
}

// UninstallFuse calls the installer with --uninstall-fuse.
func UninstallFuse(runMode libkb.RunMode, log Log) error {
	log.Info("Removing KBFuse")
	return execNativeInstallerWithArg([]string{"--uninstall-fuse"}, runMode, log)
}

// InstallHelper calls the installer with --install-helper.
func InstallHelper(runMode libkb.RunMode, log Log) error {
	log.Info("Installing Helper")
	return execNativeInstallerWithArg([]string{"--install-helper"}, runMode, log)
}

// UninstallHelper calls the installer with --uninstall-helper.
func UninstallHelper(runMode libkb.RunMode, log Log) error {
	log.Info("Removing privileged helper tool")
	return execNativeInstallerWithArg([]string{"--uninstall-helper"}, runMode, log)
}

// InstallCommandLinePrivileged calls the installer with --install-cli.
func InstallCommandLinePrivileged(runMode libkb.RunMode, log Log) error {
	log.Info("Installing command line (privileged)")
	return execNativeInstallerWithArg([]string{"--install-cli"}, runMode, log)
}

// UninstallCommandLinePrivileged calls the installer with --uninstall-cli.
func UninstallCommandLinePrivileged(runMode libkb.RunMode, log Log) error {
	log.Info("Removing command line (privileged)")
	return execNativeInstallerWithArg([]string{"--uninstall-cli"}, runMode, log)
}

// InstallAppBundle calls the installer with --install-app-bundle.
func InstallAppBundle(context Context, sourcePath string, log Log) error {
	log.Info("Install app bundle")
	return execNativeInstallerWithArg([]string{"--install-app-bundle", fmt.Sprintf("--source-path=%s", sourcePath)}, context.GetRunMode(), log)
}

// UninstallApp calls the installer with --install-app.
func UninstallApp(runMode libkb.RunMode, log Log) error {
	log.Info("Removing app")
	return execNativeInstallerWithArg([]string{"--uninstall-app"}, runMode, log)
}
