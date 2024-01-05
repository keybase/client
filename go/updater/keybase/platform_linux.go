// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
)

func (c config) destinationPath() string {
	// No destination path for Linux
	return ""
}

// Dir returns where to store config and log files
func Dir(appName string) (string, error) {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir != "" {
		return dir, nil
	}
	usr, err := user.Current()
	if err != nil {
		return "", err
	}
	if appName == "" {
		return "", fmt.Errorf("No app name for dir")
	}
	return filepath.Join(usr.HomeDir, ".config", appName), nil
}

// CacheDir returns where to store temporary files
func CacheDir(appName string) (string, error) {
	return LogDir(appName)
}

// LogDir is where to log
func LogDir(appName string) (string, error) {
	dir := os.Getenv("XDG_CACHE_HOME")
	if dir != "" {
		return dir, nil
	}
	usr, err := user.Current()
	if err != nil {
		return "", err
	}
	if appName == "" {
		return "", fmt.Errorf("No app name for dir")
	}
	return filepath.Join(usr.HomeDir, ".cache", appName), nil
}

func (c config) osVersion() string {
	result, err := command.Exec("uname", []string{"-mrs"}, 5*time.Second, c.log)
	if err != nil {
		c.log.Warningf("Error trying to determine OS version: %s (%s)", err, result.CombinedOutput())
		return ""
	}
	return strings.TrimSpace(result.Stdout.String())
}

func (c config) osArch() string {
	cmd := exec.Command("uname", "-m")
	var buf bytes.Buffer
	cmd.Stdout = &buf
	err := cmd.Run()
	if err != nil {
		c.log.Warningf("Error trying to determine OS arch, falling back to compile time arch: %s (%s)", err, cmd.Stderr)
		return runtime.GOARCH
	}
	return strings.TrimSuffix(buf.String(), "\n")
}

func (c config) promptProgram() (command.Program, error) {
	return command.Program{}, fmt.Errorf("Unsupported")
}

func (c config) notifyProgram() string {
	return "notify-send"
}

func (c context) BeforeUpdatePrompt(update updater.Update, options updater.UpdateOptions) error {
	notifyArgs := []string{
		"-i", "/usr/share/icons/hicolor/128x128/apps/keybase.png",
		fmt.Sprintf("New Keybase version: %s", update.Version),
		"Please update Keybase using your system package manager.",
	}
	result, err := command.Exec("notify-send", notifyArgs, 5*time.Second, c.log)
	if err != nil {
		c.log.Warningf("Error running notify-send: %s (%s)", err, result.CombinedOutput())
	}
	c.ReportAction(updater.UpdatePromptResponse{
		Action:         updater.UpdateActionSnooze,
		AutoUpdate:     false,
		SnoozeDuration: 0,
	}, &update, options)
	return updater.CancelErr(fmt.Errorf("Linux uses system package manager"))
}

func (c context) UpdatePrompt(update updater.Update, options updater.UpdateOptions, promptOptions updater.UpdatePromptOptions) (*updater.UpdatePromptResponse, error) {
	// No update prompt for Linux
	return &updater.UpdatePromptResponse{Action: updater.UpdateActionContinue}, nil
}

func (c context) PausedPrompt() bool {
	return false
}

func (c context) Apply(update updater.Update, options updater.UpdateOptions, tmpDir string) error {
	return nil
}

func (c context) AfterApply(update updater.Update) error {
	return nil
}

func (c context) GetAppStatePath() string {
	home, _ := Dir("keybase")
	return filepath.Join(home, "app-state.json")
}

func (c context) IsCheckCommand() bool {
	return c.isCheckCommand
}

// DeepClean is called when a faulty upgrade has been detected
func (c context) DeepClean() {}
