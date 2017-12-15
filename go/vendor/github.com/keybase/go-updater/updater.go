// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/keybase/go-updater/util"
)

// Version is the updater version
const Version = "0.2.13"

// Updater knows how to find and apply updates
type Updater struct {
	source UpdateSource
	config Config
	log    Log
}

// UpdateSource defines where the updater can find updates
type UpdateSource interface {
	// Description is a short description about the update source
	Description() string
	// FindUpdate finds an update given options
	FindUpdate(options UpdateOptions) (*Update, error)
}

// Context defines options, UI and hooks for the updater.
// This is where you can define custom behavior specific to your apps.
type Context interface {
	GetUpdateUI() UpdateUI
	UpdateOptions() UpdateOptions
	Verify(update Update) error
	BeforeUpdatePrompt(update Update, options UpdateOptions) error
	BeforeApply(update Update) error
	Apply(update Update, options UpdateOptions, tmpDir string) error
	AfterApply(update Update) error
	ReportError(err error, update *Update, options UpdateOptions)
	ReportAction(action UpdateAction, update *Update, options UpdateOptions)
	ReportSuccess(update *Update, options UpdateOptions)
	AfterUpdateCheck(update *Update)
}

// Config defines configuration for the Updater
type Config interface {
	GetUpdateAuto() (bool, bool)
	SetUpdateAuto(b bool) error
	GetUpdateAutoOverride() bool
	SetUpdateAutoOverride(bool) error
	GetInstallID() string
	SetInstallID(installID string) error
	IsLastUpdateCheckTimeRecent(d time.Duration) bool
	SetLastUpdateCheckTime()
}

// Log is the logging interface for this package
type Log interface {
	Debug(...interface{})
	Info(...interface{})
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

// NewUpdater constructs an Updater
func NewUpdater(source UpdateSource, config Config, log Log) *Updater {
	return &Updater{
		source: source,
		config: config,
		log:    log,
	}
}

// Update checks, downloads and performs an update
func (u *Updater) Update(ctx Context) (*Update, error) {
	options := ctx.UpdateOptions()
	update, err := u.update(ctx, options)
	report(ctx, err, update, options)
	return update, err
}

// update returns the update received, and an error if the update was not
// performed. The error with be of type Error. The error may be due to the user
// (or system) canceling an update, in which case error.IsCancel() will be true.
func (u *Updater) update(ctx Context, options UpdateOptions) (*Update, error) {
	update, err := u.checkForUpdate(ctx, options)
	if err != nil {
		return nil, findErr(err)
	}
	if update == nil || !update.NeedUpdate {
		// No update available
		return nil, nil
	}
	u.log.Infof("Got update with version: %s", update.Version)

	err = ctx.BeforeUpdatePrompt(*update, options)
	if err != nil {
		return update, err
	}

	// Prompt for update
	updateAction, err := u.promptForUpdateAction(ctx, *update, options)
	if err != nil {
		return update, promptErr(err)
	}
	switch updateAction {
	case UpdateActionApply:
		ctx.ReportAction(UpdateActionApply, update, options)
	case UpdateActionAuto:
		ctx.ReportAction(UpdateActionAuto, update, options)
	case UpdateActionSnooze:
		ctx.ReportAction(UpdateActionSnooze, update, options)
		return update, CancelErr(fmt.Errorf("Snoozed update"))
	case UpdateActionCancel:
		ctx.ReportAction(UpdateActionCancel, update, options)
		return update, CancelErr(fmt.Errorf("Canceled"))
	case UpdateActionError:
		return update, promptErr(fmt.Errorf("Unknown prompt error"))
	case UpdateActionContinue:
		// Continue
	}

	// Linux updates don't have assets so it's ok to prompt for update above before
	// we check for nil asset.
	if update.Asset == nil || update.Asset.URL == "" {
		u.log.Info("No update asset to apply")
		return update, nil
	}

	tmpDir := u.tempDir()
	defer u.Cleanup(tmpDir)
	if err := u.downloadAsset(update.Asset, tmpDir, options); err != nil {
		return update, downloadErr(err)
	}

	u.log.Infof("Verify asset: %s", update.Asset.LocalPath)
	if err := ctx.Verify(*update); err != nil {
		return update, verifyErr(err)
	}

	if err := u.apply(ctx, *update, options, tmpDir); err != nil {
		return update, err
	}

	return update, nil
}

func (u *Updater) apply(ctx Context, update Update, options UpdateOptions, tmpDir string) error {
	u.log.Info("Before apply")
	if err := ctx.BeforeApply(update); err != nil {
		return applyErr(err)
	}

	u.log.Info("Applying update")
	if err := ctx.Apply(update, options, tmpDir); err != nil {
		return applyErr(err)
	}

	u.log.Info("After apply")
	if err := ctx.AfterApply(update); err != nil {
		return applyErr(err)
	}

	return nil
}

// downloadAsset will download the update to a temporary path (if not cached),
// check the digest, and set the LocalPath property on the asset.
func (u *Updater) downloadAsset(asset *Asset, tmpDir string, options UpdateOptions) error {
	if asset == nil {
		return fmt.Errorf("No asset to download")
	}
	downloadOptions := util.DownloadURLOptions{
		Digest:        asset.Digest,
		RequireDigest: true,
		UseETag:       true,
		Log:           u.log,
	}

	downloadPath := filepath.Join(tmpDir, asset.Name)
	// If asset had a file extension, lets add it back on
	if err := util.DownloadURL(asset.URL, downloadPath, downloadOptions); err != nil {
		return err
	}

	asset.LocalPath = downloadPath
	return nil
}

// checkForUpdate checks a update source (like a remote API) for an update.
// It may set an InstallID, if the server tells us to.
func (u *Updater) checkForUpdate(ctx Context, options UpdateOptions) (*Update, error) {
	u.log.Infof("Checking for update, current version is %s", options.Version)
	u.log.Infof("Using updater source: %s", u.source.Description())
	u.log.Debugf("Using options: %#v", options)

	update, findErr := u.source.FindUpdate(options)
	if findErr != nil {
		return nil, findErr
	}
	if update == nil {
		return nil, nil
	}

	// Save InstallID if we received one
	if update.InstallID != "" && u.config.GetInstallID() != update.InstallID {
		u.log.Debugf("Saving install ID: %s", update.InstallID)
		if err := u.config.SetInstallID(update.InstallID); err != nil {
			u.log.Warningf("Error saving install ID: %s", err)
			ctx.ReportError(configErr(fmt.Errorf("Error saving install ID: %s", err)), update, options)
		}
	}

	return update, nil
}

// promptForUpdateAction prompts the user for permission to apply an update
func (u *Updater) promptForUpdateAction(ctx Context, update Update, options UpdateOptions) (UpdateAction, error) {
	u.log.Debug("Prompt for update")

	auto, autoSet := u.config.GetUpdateAuto()
	autoOverride := u.config.GetUpdateAutoOverride()
	u.log.Debugf("Auto update: %s (set=%s autoOverride=%s)", strconv.FormatBool(auto), strconv.FormatBool(autoSet), strconv.FormatBool(autoOverride))
	if auto && !autoOverride {
		return UpdateActionAuto, nil
	}

	updateUI := ctx.GetUpdateUI()

	// If auto update never set, default to true
	autoUpdate := !autoSet
	promptOptions := UpdatePromptOptions{AutoUpdate: autoUpdate}
	updatePromptResponse, err := updateUI.UpdatePrompt(update, options, promptOptions)
	if err != nil {
		return UpdateActionError, err
	}
	if updatePromptResponse == nil {
		return UpdateActionError, fmt.Errorf("No response")
	}

	if updatePromptResponse.Action != UpdateActionContinue {
		u.log.Debugf("Update prompt response: %#v", updatePromptResponse)
		if err := u.config.SetUpdateAuto(updatePromptResponse.AutoUpdate); err != nil {
			u.log.Warningf("Error setting auto preference: %s", err)
			ctx.ReportError(configErr(fmt.Errorf("Error setting auto preference: %s", err)), &update, options)
		}
	}

	return updatePromptResponse.Action, nil
}

func report(ctx Context, err error, update *Update, options UpdateOptions) {
	if err != nil {
		// Don't report cancels
		switch e := err.(type) {
		case Error:
			if e.IsCancel() {
				return
			}
		}
		ctx.ReportError(err, update, options)
	} else if update != nil {
		ctx.ReportSuccess(update, options)
	}
}

// tempDir, if specified, will contain files that were replaced during an update
// and will be removed after an update. The temp dir should already exist.
func (u *Updater) tempDir() string {
	tmpDir := util.TempPath("", "KeybaseUpdater.")
	if err := util.MakeDirs(tmpDir, 0700, u.log); err != nil {
		u.log.Warningf("Error trying to create temp dir: %s", err)
		return ""
	}
	return tmpDir
}

// Cleanup removes temporary files
func (u *Updater) Cleanup(tmpDir string) {
	if tmpDir != "" {
		u.log.Debugf("Remove temporary directory: %q", tmpDir)
		if err := os.RemoveAll(tmpDir); err != nil {
			u.log.Warningf("Error removing temporary directory %q: %s", tmpDir, err)
		}
	}
}
