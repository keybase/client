// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/kardianos/osext"
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/process"
	"github.com/keybase/client/go/updater/util"
)

// execPath returns the app bundle path where this executable is located
func (c config) execPath() string {
	path, err := osext.Executable()
	if err != nil {
		c.log.Warningf("Error trying to determine our executable path: %s", err)
		return ""
	}
	return path
}

// destinationPath returns the app bundle path where this executable is located
func (c config) destinationPath() string {
	return appBundleForPath(c.execPath())
}

func appBundleForPath(path string) string {
	if path == "" {
		return ""
	}
	paths := strings.SplitN(path, ".app", 2)
	// If no match, return ""
	if len(paths) <= 1 {
		return ""
	}
	return paths[0] + ".app"
}

func libraryDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, "Library"), nil
}

// Dir returns where to store config
func Dir(appName string) (string, error) {
	if appName == "" {
		return "", fmt.Errorf("No app name for dir")
	}
	libDir, err := libraryDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(libDir, "Application Support", appName), nil
}

// CacheDir returns where to store temporary files
func CacheDir(appName string) (string, error) {
	if appName == "" {
		return "", fmt.Errorf("No app name for dir")
	}
	return filepath.Join(os.TempDir(), appName), nil
}

// LogDir is where to log
func LogDir(appName string) (string, error) {
	libDir, err := libraryDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(libDir, "Logs"), nil
}

func (c config) osVersion() string {
	result, err := command.Exec("/usr/bin/sw_vers", []string{"-productVersion"}, 5*time.Second, c.log)
	if err != nil {
		c.log.Warningf("Error trying to determine OS version: %s (%s)", err, result.CombinedOutput())
		return ""
	}
	return strings.TrimSpace(result.Stdout.String())
}

func (c config) osArch() string {
	r, err := syscall.Sysctl("sysctl.proc_translated")
	if err == nil {
		if r == "\x00\x00\x00" || r == "\x01\x00\x00" {
			// running on apple silicon, maybe in rosetta mode.
			// return arm64 here to upgrade users to the arm64 built version
			return "arm64"
		}
	}
	c.log.Warningf("Error trying to determine OS arch: %s sysct.proc_translated=%s", err, r)
	cmd := exec.Command("uname", "-m")
	var buf bytes.Buffer
	cmd.Stdout = &buf
	err = cmd.Run()
	if err != nil {
		c.log.Warningf("Error trying to determine OS arch, falling back to compile time arch: %s (%s)", err, cmd.Stderr)
		return runtime.GOARCH
	}
	return strings.TrimSuffix(buf.String(), "\n")
}

func (c config) promptProgram() (command.Program, error) {
	destinationPath := c.destinationPath()
	if destinationPath == "" {
		return command.Program{}, fmt.Errorf("No destination path")
	}
	return command.Program{
		Path: filepath.Join(destinationPath, "Contents", "Resources", "KeybaseUpdater.app", "Contents", "MacOS", "Updater"),
	}, nil
}

func (c config) notifyProgram() string {
	// No notify program for Darwin
	return ""
}

func (c context) BeforeUpdatePrompt(update updater.Update, options updater.UpdateOptions) error {
	return nil
}

// UpdatePrompt is called when the user needs to accept an update
func (c context) UpdatePrompt(update updater.Update, options updater.UpdateOptions, promptOptions updater.UpdatePromptOptions) (*updater.UpdatePromptResponse, error) {
	promptProgram, err := c.config.promptProgram()
	if err != nil {
		return nil, err
	}
	return c.updatePrompt(promptProgram, update, options, promptOptions, time.Hour)
}

// PausedPrompt is called when the we can't update cause the app is in use.
// We return true if the use wants to cancel the update.
func (c context) PausedPrompt() bool {
	promptProgram, err := c.config.promptProgram()
	if err != nil {
		c.log.Warningf("Error trying to get prompt path: %s", err)
		return false
	}
	cancelUpdate, err := c.pausedPrompt(promptProgram, 5*time.Minute)
	if err != nil {
		c.log.Warningf("Error in paused prompt: %s", err)
		return false
	}
	return cancelUpdate
}

func (c context) GetAppStatePath() string {
	home, _ := Dir("keybase")
	return filepath.Join(home, "app-state.json")
}

func (c context) IsCheckCommand() bool {
	return c.isCheckCommand
}

const serviceInBundlePath = "/Contents/SharedSupport/bin/keybase"
const kbfsInBundlePath = "/Contents/SharedSupport/bin/kbfs"

type processPaths struct {
	serviceProcPath string
	kbfsProcPath    string
	appPath         string
	appProcPath     string
}

func (c context) lookupProcessPaths() (p processPaths, _ error) {
	appPath := c.config.destinationPath() // "/Applications/Keybase.app"
	if appPath == "" {
		return p, fmt.Errorf("No app path")
	}
	appBundleName := filepath.Base(appPath) // "Keybase.app"

	p.appPath = appPath
	p.serviceProcPath = appBundleName + serviceInBundlePath
	p.kbfsProcPath = appBundleName + kbfsInBundlePath
	p.appProcPath = appBundleName + "/Contents/MacOS/"

	return p, nil
}

// stop will quit the app and any services
func (c context) stop() error {
	// Stop app
	appExitResult, appExitErr := command.Exec(c.config.keybasePath(), []string{"ctl", "app-exit"}, 30*time.Second, c.log)
	c.log.Infof("Stop output: %s", appExitResult.CombinedOutput())
	if appExitErr != nil {
		c.log.Warningf("Error requesting app exit: %s", appExitErr)
	}

	// Stop the redirector so it can be upgraded for all users.
	_, redirectorErr := command.Exec(c.config.keybasePath(), []string{"uninstall", "--components=redirector"}, time.Minute, c.log)
	if redirectorErr != nil {
		c.log.Warningf("Error stopping the redirector: %s", redirectorErr)
	}

	// Stop services
	servicesExitResult, servicesExitErr := command.Exec(c.config.keybasePath(), []string{"ctl", "stop", "--include=service,kbfs"}, 30*time.Second, c.log)
	c.log.Infof("Stop output: %s", servicesExitResult.CombinedOutput())
	if servicesExitErr != nil {
		c.log.Warningf("Error stopping services: %s", servicesExitErr)
	}

	paths, err := c.lookupProcessPaths()
	if err != nil {
		return err
	}

	// SIGKILL the app if it failed to exit (if it exited, then this doesn't do anything)
	c.log.Infof("Killing (if failed to exit) %s", paths.appProcPath)
	process.KillAll(process.NewMatcher(paths.appProcPath, process.PathContains, c.log), c.log)

	return nil
}

// AfterApply is called after an update is applied
func (c context) AfterApply(update updater.Update) error {
	if err := c.stop(); err != nil {
		c.log.Warningf("Error trying to stop: %s", err)
	}

	if err := c.start(10*time.Second, time.Second); err != nil {
		c.log.Warningf("Error trying to start the app: %s", err)
	}
	return nil
}

// Start the app.
// The wait is how log to wait for processes and the app to start before
// reporting that an error occurred.
func (c context) start(wait time.Duration, delay time.Duration) error {
	procPaths, err := c.lookupProcessPaths()
	if err != nil {
		return err
	}

	if err := OpenAppDarwin(procPaths.appPath, c.log); err != nil {
		c.log.Warningf("Error opening app: %s", err)
	}

	// Check to make sure processes started
	c.log.Debugf("Checking processes: %#v", procPaths)
	serviceProcErr := c.checkProcess(procPaths.serviceProcPath, wait, delay)
	kbfsProcErr := c.checkProcess(procPaths.kbfsProcPath, wait, delay)
	appProcErr := c.checkProcess(procPaths.appProcPath, wait, delay)

	return util.CombineErrors(serviceProcErr, kbfsProcErr, appProcErr)
}

func (c context) checkProcess(match string, wait time.Duration, delay time.Duration) error {
	matcher := process.NewMatcher(match, process.PathContains, c.log)
	procs, err := process.FindProcesses(matcher, wait, delay, c.log)
	if err != nil {
		return fmt.Errorf("Error checking on process (%s): %s", match, err)
	}
	if len(procs) == 0 {
		return fmt.Errorf("No process found for %s", match)
	}
	return nil
}

// OpenAppDarwin starts an app
func OpenAppDarwin(appPath string, log process.Log) error {
	return openAppDarwin("/usr/bin/open", appPath, time.Second, log)
}

func openAppDarwin(bin string, appPath string, retryDelay time.Duration, log process.Log) error {
	tryOpen := func() error {
		env := append(os.Environ(), "KEYBASE_RESTORE_UI=true", "KEYBASE_START_UI=hideWindow", "KEYBASE_OPEN_FROM=updater")
		result, err := command.ExecWithEnv(bin, []string{appPath}, env, time.Minute, log)
		if err != nil {
			return fmt.Errorf("Open error: %s; %s", err, result.CombinedOutput())
		}
		return nil
	}
	// We need to try 10 times because Gatekeeper has some issues, for example,
	// http://www.openradar.me/23614087
	var err error
	for i := 0; i < 10; i++ {
		err = tryOpen()
		if err == nil {
			break
		}
		log.Errorf("Open error (trying again in %s): %s", retryDelay, err)
		time.Sleep(retryDelay)
	}
	return err
}

func (c context) check(sourcePath string, destinationPath string) error {
	// Check to make sure the update source path is a real directory
	ok, err := util.IsDirReal(sourcePath)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("Source path isn't a directory")
	}
	return nil
}

func (c context) apply(localPath string, destinationPath string, tmpDir string) error {
	// The file name we unzip over should match the (base) file in the destination path
	filename := filepath.Base(destinationPath)
	return util.UnzipOver(localPath, filename, destinationPath, c.check, tmpDir, c.log)
}

func (c context) Apply(update updater.Update, options updater.UpdateOptions, tmpDir string) error {
	if update.Asset == nil {
		return fmt.Errorf("No asset")
	}
	localPath := update.Asset.LocalPath
	destinationPath := options.DestinationPath

	err := c.apply(localPath, destinationPath, tmpDir)
	switch err := err.(type) {
	case nil:
	case *os.LinkError:
		if err.Op == "rename" && err.Old == "/Applications/Keybase.app" {
			c.log.Infof("The error was a problem renaming (moving) the app, let's trying installing the app via keybase install --components=app which has more privileges: %s", err)

			// Unzip and get source path
			unzipPath, err := util.UnzipPath(localPath, c.log)
			defer util.RemoveFileAtPath(unzipPath)
			if err != nil {
				return err
			}
			sourcePath := filepath.Join(unzipPath, filepath.Base(destinationPath))

			_, installErr := command.Exec(c.config.keybasePath(), []string{"install", "--components=app", fmt.Sprintf("--source-path=%s", sourcePath)}, time.Minute, c.log)
			if installErr != nil {
				c.log.Errorf("Error trying to install the app (privileged): %s", installErr)
				return installErr
			}
		} else {
			return err
		}
	default:
		return err
	}

	// Update spotlight
	c.log.Debugf("Updating spotlight: %s", destinationPath)
	spotlightResult, spotLightErr := command.Exec("/usr/bin/mdimport", []string{destinationPath}, 20*time.Second, c.log)
	if spotLightErr != nil {
		c.log.Warningf("Error trying to update spotlight: %s, (%s)", spotLightErr, spotlightResult.CombinedOutput())
	}

	// Remove quantantine (if any)
	c.log.Debugf("Remove quarantine: %s", destinationPath)
	quarantineResult, quarantineErr := command.Exec("/usr/bin/xattr", []string{"-d", "com.apple.quarantine", destinationPath}, 20*time.Second, c.log)
	if quarantineErr != nil {
		c.log.Warningf("Error trying to remove quarantine: %s, (%s)", quarantineErr, quarantineResult.CombinedOutput())
	}

	return nil
}

// DeepClean is called when a faulty upgrade has been detected
func (c context) DeepClean() {}
