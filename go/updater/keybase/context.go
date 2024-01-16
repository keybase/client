// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"fmt"
	"os"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/saltpack"
)

// validCodeSigningKIDs are the list of valid code signing IDs for saltpack verify
var validCodeSigningKIDs = map[string]bool{
	"01209092ae4e790763dc7343851b977930f35b16cf43ab0ad900a2af3d3ad5cea1a10a": true, // keybot (device)
	"012045891a45f03cec001196ad05207f3f80045b2b9f0ca38288a85f8120ac74db960a": true, // max (tiber - 2019-01)
	"012065ae849d1949a8b0021b165b0edaf722e2a7a9036e07817e056e2d721bddcc0e0a": true, // max (cry glass)
	"01202a70fa31596ae2afabbbea827c7d1efb205c4b02b2b98b8f8c75915be433ccb50a": true, // mike (demise sort)
	"0120f2f55c76151b3eaf91d20dfb673d8591d8b49fd5cb210a10f6e0dd8724bf34f30a": true, // mike (lisa-5k-redux)
	"0120deaa8ae7d06ea9aa49cc678ec49f2b1e1dddb63683e384db539a8649c47925f90a": true, // winbot (device)
}

// Log is the logging interface for the keybase package
type Log interface {
	Debug(...interface{})
	Info(...interface{})
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// context is an updater.Context implementation
type context struct {
	// config is updater config
	config Config
	// log is the logger
	log Log
	// isCheckCommand is whether the updater is being invoked with the check command
	isCheckCommand bool
}

// endpoints define all the url locations for reporting, etc
type endpoints struct {
	update  string
	action  string
	success string
	err     string
}

var defaultEndpoints = endpoints{
	update:  "https://api-1.core.keybaseapi.com/_/api/1.0/pkg/update.json",
	action:  "https://api-1.core.keybaseapi.com/_/api/1.0/pkg/act.json",
	success: "https://api-1.core.keybaseapi.com/_/api/1.0/pkg/success.json",
	err:     "https://api-1.core.keybaseapi.com/_/api/1.0/pkg/error.json",
}

func newContext(cfg Config, log Log) *context {
	ctx := context{
		config: cfg,
		log:    log,
	}
	return &ctx
}

func newContextCheckCmd(cfg Config, log Log, isCheckCommand bool) *context {
	ctx := newContext(cfg, log)
	ctx.isCheckCommand = isCheckCommand
	return ctx
}

// UpdaterMode describes how updater should behave.
type UpdaterMode int

const (
	_            UpdaterMode = iota
	Service                  // used in service mode; never ignores snooze
	Check                    // ignores snooze
	CheckPassive             // does not ignore snooze
)

// IsCheck returns true if we are not running in service mode.
func (m UpdaterMode) IsCheck() bool {
	return m == Check || m == CheckPassive
}

// IgnoreSnooze returns true if we should ignore snooze.
func (m UpdaterMode) IgnoreSnooze() bool {
	return m == Check
}

// NewUpdaterContext returns an updater context for Keybase
func NewUpdaterContext(appName string, pathToKeybase string, log Log, mode UpdaterMode) (updater.Context, *updater.Updater) {
	cfg, err := newConfig(appName, pathToKeybase, log, mode.IgnoreSnooze())
	if err != nil {
		log.Warningf("Error loading config for context: %s", err)
	}

	src := NewUpdateSource(cfg, log)

	// For testing, you can use a local updater source.
	// Add your local device signing key to `validCodeSigningKIDs` above (note that the first and last byte are stripped off).
	// (cd /Applications; ditto -c -k --sequesterRsrc --keepParent Keybase.app /tmp/Keybase.zip)
	// keybase sign --saltpack-version "1" -d -i "/tmp/Keybase.zip" -o "/tmp/update.sig"
	// release update-json --version=`keybase version -S` --src=/tmp/Keybase.zip --uri=/tmp --signature=/tmp/update.sig > /tmp/update.json
	// Uncomment the following line and the `sources` import above.
	// src := sources.NewLocalUpdateSource("/tmp/Keybase.zip", "/tmp/update.json", log)
	// cd $GOPATH/src/github.com/keybase/client/go/updater/service
	// go build
	// cp service /Applications/Keybase.app/Contents/SharedSupport/bin/updater
	// keybase launchd stop keybase.updater
	// keybase update check

	upd := updater.NewUpdater(src, cfg, log)
	return newContextCheckCmd(cfg, log, mode.IsCheck()), upd
}

// UpdateOptions returns update options
func (c *context) UpdateOptions() updater.UpdateOptions {
	return c.config.updaterOptions()
}

// GetUpdateUI returns Update UI
func (c *context) GetUpdateUI() updater.UpdateUI {
	return c
}

// GetLog returns log
func (c context) GetLog() Log {
	return c.log
}

// Verify verifies the signature
func (c context) Verify(update updater.Update) error {
	return saltpack.VerifyDetachedFileAtPath(update.Asset.LocalPath, update.Asset.Signature, validCodeSigningKIDs, c.log)
}

type checkInUseResult struct {
	InUse bool `json:"in_use"`
}

func (c context) checkInUse() (bool, error) {
	var result checkInUseResult
	if err := command.ExecForJSON(c.config.keybasePath(), []string{"update", "check-in-use"}, &result, time.Minute, c.log); err != nil {
		return false, err
	}
	return result.InUse, nil
}

// BeforeApply is called before an update is applied
func (c context) BeforeApply(update updater.Update) error {
	inUse, err := c.checkInUse()
	if err != nil {
		c.log.Warningf("Error trying to check in use: %s", err)
	}
	if inUse {
		if cancel := c.PausedPrompt(); cancel {
			return fmt.Errorf("Canceled by user from paused prompt")
		}
	}
	return nil
}

func (c context) AfterUpdateCheck(update *updater.Update) {
	if update != nil {
		// If we received an update from the check let's exit, so the watchdog
		// process (e.g. launchd on darwin) can restart us, no matter what, even if
		// there was an error, and even if the update was or wasn't applied.
		// There is no difference between doing another update check in a loop after
		// delay and restarting the service.
		c.log.Infof("%s", "Exiting for restart")
		// Allow the log to write, since os.Exit can be abrupt
		time.Sleep(2 * time.Second)
		os.Exit(0)
	}
}
