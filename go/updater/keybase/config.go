// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/util"
)

// Config is Keybase specific configuration for the updater
type Config interface {
	updater.Config
	keybasePath() string
	promptProgram() (command.Program, error)
	notifyProgram() string
	destinationPath() string
	updaterOptions() updater.UpdateOptions
}

type config struct {
	// appName is the name of the app, e.g. "Keybase"
	appName string
	// pathToKeybase is the location of the keybase executable
	pathToKeybase string
	// log is the logging location
	log Log
	// store is the config values
	store store
	// autoOverride is whether the current auto setting should be temporarily overridden
	autoOverride bool
	// ignoreSnooze corresponds to UpdateOptions.IgnoreSnooze
	ignoreSnooze bool
}

// store is the config values
type store struct {
	// InstallID is an identifier returned by the API on first update that is a
	// sent on subsequent requests.
	InstallID string `json:"installId"`
	// Auto is the whether to update automatically; this value and AutoSet below
	// should be true for an update to be automatically applied.
	Auto bool `json:"auto"`
	// AutoSet is whether a user set the Auto config
	AutoSet bool `json:"autoSet"`
	// LastAppliedVersion is for detecting upgrade error condition
	LastAppliedVersion string `json:"lastAppliedVersion"`
}

// newConfig loads a config, which is valid even if it has an error
func newConfig(appName string, pathToKeybase string, log Log, ignoreSnooze bool) (*config, error) {
	cfg := newDefaultConfig(appName, pathToKeybase, log, ignoreSnooze)
	err := cfg.load()
	return &cfg, err
}

func newDefaultConfig(appName string, pathToKeybase string, log Log, ignoreSnooze bool) config {
	return config{
		appName:       appName,
		pathToKeybase: pathToKeybase,
		log:           log,
		ignoreSnooze:  ignoreSnooze,
	}
}

// load the config
func (c *config) load() error {
	path, err := c.path()
	if err != nil {
		return nil
	}
	return c.loadFromPath(path)
}

func (c *config) loadFromPath(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("Unable to open config file: %s", err)
	}
	if file == nil {
		return fmt.Errorf("No file")
	}
	defer util.Close(file)

	decoder := json.NewDecoder(file)
	var decodeStore store
	if err := decoder.Decode(&decodeStore); err != nil {
		return err
	}
	c.store = decodeStore
	return nil
}

func (c config) path() (string, error) {
	configDir, err := Dir(c.appName)
	if err != nil {
		return "", err
	}
	if configDir == "" {
		return "", fmt.Errorf("No config dir")
	}
	path := filepath.Join(configDir, "updater.json")
	return path, nil
}

func (c config) updateCheckTouchPath() (string, error) {
	configDir, err := Dir(c.appName)
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "updater.last"), nil
}

// IsLastUpdateCheckTimeRecent returns true if we've updated within duration.
// If there is any kind of error, returns true.
func (c config) IsLastUpdateCheckTimeRecent(d time.Duration) bool {
	path, err := c.updateCheckTouchPath()
	if err != nil {
		c.log.Errorf("Error getting check path: %s", err)
		return true
	}
	t, err := util.FileModTime(path)
	if err != nil {
		if os.IsNotExist(err) {
			c.log.Infof("No last update time")
		} else {
			c.log.Errorf("Error getting last update time: %s", err)
		}
		return true
	}
	recent := time.Since(t) < d
	c.log.Debugf("Last update time (is recent? %s): %s", strconv.FormatBool(recent), t)
	return recent
}

// SetLastUpdateCheckTime touches file to set last update time.
func (c config) SetLastUpdateCheckTime() {
	path, err := c.updateCheckTouchPath()
	if err != nil {
		c.log.Errorf("Error getting check path: %s", err)
		return
	}
	terr := util.Touch(path)
	if terr != nil {
		c.log.Errorf("Error setting last update time: %s", terr)
		return
	}
	c.log.Debugf("Set last update time")
}

func (c config) save() error {
	path, err := c.path()
	if err != nil {
		return err
	}
	return c.saveToPath(path)
}

func (c config) saveToPath(path string) error {
	b, err := json.MarshalIndent(c.store, "", "  ")
	if err != nil {
		return fmt.Errorf("Error marshaling config: %s", err)
	}
	file := util.NewFile(path, b, 0600)
	err = util.MakeParentDirs(path, 0700, c.log)
	if err != nil {
		return err
	}
	return file.Save(c.log)
}

// GetUpdateAuto is the whether to update automatically and whether the user has
// set this value. Both should be true for an update to be automatically
// applied.
func (c config) GetUpdateAuto() (bool, bool) {
	return c.store.Auto, c.store.AutoSet
}

func (c *config) SetUpdateAuto(auto bool) error {
	c.store.Auto = auto
	c.store.AutoSet = true
	return c.save()
}

// For overriding the current Auto setting
func (c config) GetUpdateAutoOverride() bool {
	return c.autoOverride
}

func (c *config) SetUpdateAutoOverride(auto bool) error {
	c.autoOverride = auto
	return nil
}

// For reporting the last version applied
func (c config) GetLastAppliedVersion() string {
	return c.store.LastAppliedVersion
}

func (c *config) SetLastAppliedVersion(version string) error {
	c.store.LastAppliedVersion = version
	return c.save()
}

// GetInstallID is an identifier returned by the API on first update that is a
// sent on subsequent requests.
func (c config) GetInstallID() string {
	return c.store.InstallID
}

func (c *config) SetInstallID(installID string) error {
	c.store.InstallID = installID
	return c.save()
}

func (c config) updaterOptions() updater.UpdateOptions {
	version := c.keybaseVersion()
	osVersion := c.osVersion()
	osArch := c.osArch()
	platform := runtime.GOOS
	if platform == "darwin" && osArch == "arm64" {
		platform = "darwin-arm64"
	}

	return updater.UpdateOptions{
		Version:         version,
		Platform:        platform,
		Arch:            osArch,
		DestinationPath: c.destinationPath(),
		Env:             "prod",
		OSVersion:       osVersion,
		UpdaterVersion:  updater.Version,
		IgnoreSnooze:    c.ignoreSnooze,
	}
}

func (c config) keybasePath() string {
	return c.pathToKeybase
}

func (c config) keybaseVersion() string {
	result, err := command.Exec(c.keybasePath(), []string{"version", "-S"}, 20*time.Second, c.log)
	if err != nil {
		c.log.Warningf("Couldn't get keybase version: %s (%s)", err, result.CombinedOutput())
		return ""
	}
	return strings.TrimSpace(result.Stdout.String())
}
