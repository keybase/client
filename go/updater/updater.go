// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/updater/util"
)

// Version is the updater version
const Version = "0.3.8"

// Updater knows how to find and apply updates
type Updater struct {
	source       UpdateSource
	config       Config
	log          Log
	guiBusyCount int
	tickDuration time.Duration
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
	ReportAction(updatePromptResponse UpdatePromptResponse, update *Update, options UpdateOptions)
	ReportSuccess(update *Update, options UpdateOptions)
	AfterUpdateCheck(update *Update)
	GetAppStatePath() string
	IsCheckCommand() bool
	DeepClean()
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
	SetLastAppliedVersion(string) error
	GetLastAppliedVersion() string
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
		source:       source,
		config:       config,
		log:          log,
		tickDuration: DefaultTickDuration,
	}
}

func (u *Updater) SetTickDuration(dur time.Duration) {
	u.tickDuration = dur
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

	if update.missingAsset() {
		return update, nil
	}

	if err := u.CleanupPreviousUpdates(); err != nil {
		u.log.Infof("Error cleaning up previous downloads: %v", err)
	}

	tmpDir := u.tempDir()
	defer u.Cleanup(tmpDir)
	if err := u.downloadAsset(update.Asset, tmpDir, options); err != nil {
		return update, downloadErr(err)
	}

	err = ctx.BeforeUpdatePrompt(*update, options)
	if err != nil {
		return update, err
	}

	// Prompt for update
	updatePromptResponse, err := u.promptForUpdateAction(ctx, *update, options)
	if err != nil {
		return update, promptErr(err)
	}
	switch updatePromptResponse.Action {
	case UpdateActionApply:
		ctx.ReportAction(updatePromptResponse, update, options)
	case UpdateActionAuto:
		ctx.ReportAction(updatePromptResponse, update, options)
	case UpdateActionSnooze:
		ctx.ReportAction(updatePromptResponse, update, options)
		return update, CancelErr(fmt.Errorf("Snoozed update"))
	case UpdateActionCancel:
		ctx.ReportAction(updatePromptResponse, update, options)
		return update, CancelErr(fmt.Errorf("Canceled"))
	case UpdateActionError:
		return update, promptErr(fmt.Errorf("Unknown prompt error"))
	case UpdateActionContinue:
		// Continue
	case UpdateActionUIBusy:
		// Return nil so that AfterUpdateCheck won't exit the service
		return nil, guiBusyErr(fmt.Errorf("User active, retrying later"))
	}

	// If we are auto-updating, do a final check if the user is active before
	// killing the app. Note this can cause some churn with re-downloading the
	// update on the next attempt.
	if updatePromptResponse.Action == UpdateActionAuto && !ctx.IsCheckCommand() {
		isActive, err := u.checkUserActive(ctx)
		if err == nil && isActive {
			return nil, guiBusyErr(fmt.Errorf("User active, retrying later"))
		}
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

func (u *Updater) ApplyDownloaded(ctx Context) (bool, error) {
	options := ctx.UpdateOptions()

	// 1. check with the api server again for the latest update to be sure that a
	// new update has not come out since our last call to CheckAndDownload
	u.log.Infof("Attempting to apply previously downloaded update")
	update, err := u.checkForUpdate(ctx, options)
	if err != nil {
		return false, findErr(err)
	}

	// Only report apply success/failure
	applied, err := u.applyDownloaded(ctx, update, options)
	defer report(ctx, err, update, options)
	if err != nil {
		return false, err
	}
	return applied, nil

}

// ApplyDownloaded will look for an previously downloaded update and attempt to apply it without prompting.
// CheckAndDownload must be called first so that we have a download asset available to apply.
func (u *Updater) applyDownloaded(ctx Context, update *Update, options UpdateOptions) (applied bool, err error) {
	if update == nil || !update.NeedUpdate {
		return false, fmt.Errorf("No previously downloaded update to apply since client is update to date")
	}
	u.log.Infof("Got update with version: %s", update.Version)

	if update.missingAsset() {
		return false, fmt.Errorf("Update contained no asset to apply. Update version: %s", update.Version)
	}

	// 2. check the disk via FindDownloadedAsset. Compare our API result to this
	// result. If the downloaded update is stale, clear it and start over.
	downloadedAssetPath, err := u.FindDownloadedAsset(update.Asset.Name)
	if err != nil {
		return false, err
	}
	defer func() {
		if err := u.CleanupPreviousUpdates(); err != nil {
			u.log.Infof("Error cleaning up previous downloads: %v", err)
		}
	}()
	if downloadedAssetPath == "" {
		return false, fmt.Errorf("No downloaded asset found for version: %s", update.Version)
	}
	update.Asset.LocalPath = downloadedAssetPath

	// 3. otherwise use the update on disk and apply it.
	if err = util.CheckDigest(update.Asset.Digest, downloadedAssetPath, u.log); err != nil {
		return false, verifyErr(err)
	}
	u.log.Infof("Verify asset: %s", downloadedAssetPath)
	if err := ctx.Verify(*update); err != nil {
		return false, verifyErr(err)
	}

	tmpDir := os.TempDir()
	if err := u.apply(ctx, *update, options, tmpDir); err != nil {
		return false, err
	}

	return true, nil
}

func (u *Updater) apply(ctx Context, update Update, options UpdateOptions, tmpDir string) error {
	u.log.Info("Before apply")
	if err := ctx.BeforeApply(update); err != nil {
		return applyErr(err)
	}

	u.log.Info("Applying update")
	if err := ctx.Apply(update, options, tmpDir); err != nil {
		u.log.Info("Apply error: %v", err)
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

// NeedUpdate returns true if we are out-of-date.
func (u *Updater) NeedUpdate(ctx Context) (upToDate bool, err error) {
	update, err := u.checkForUpdate(ctx, ctx.UpdateOptions())
	if err != nil {
		return false, err
	}
	return update.NeedUpdate, nil
}

func (u *Updater) CheckAndDownload(ctx Context) (updateAvailable, updateWasDownloaded bool, err error) {
	options := ctx.UpdateOptions()
	update, err := u.checkForUpdate(ctx, options)
	if err != nil {
		return false, false, err
	}

	if !update.NeedUpdate || update.missingAsset() {
		return false, false, nil
	}

	var tmpDir string
	defer func() {
		// If anything in this process errors cleanup the downloaded asset
		if err != nil {
			if err := u.CleanupPreviousUpdates(); err != nil {
				u.log.Infof("Error cleaning up previous downloads: %v", err)
			}
		}
		if tmpDir != "" {
			u.Cleanup(tmpDir)
		}
	}()
	var digestChecked bool
	downloadedAssetPath, err := u.FindDownloadedAsset(update.Asset.Name)
	if downloadedAssetPath == "" || err != nil {
		u.log.Infof("Could not find existing download asset for version: %s. Downloading new asset.", update.Version)
		tmpDir = u.tempDir()
		// This will set update.Asset.LocalPath
		if err := u.downloadAsset(update.Asset, tmpDir, options); err != nil {
			return false, false, downloadErr(err)
		}
		updateWasDownloaded = true
		digestChecked = true
		downloadedAssetPath = update.Asset.LocalPath
	}
	// Verify depends on LocalPath being set to the downloaded asset
	update.Asset.LocalPath = downloadedAssetPath

	u.log.Infof("Verify asset: %s", downloadedAssetPath)
	if err := ctx.Verify(*update); err != nil {
		return false, false, verifyErr(err)
	}

	if !digestChecked {
		if err = util.CheckDigest(update.Asset.Digest, downloadedAssetPath, u.log); err != nil {
			return false, false, verifyErr(err)
		}
	}

	return true, updateWasDownloaded, nil
}

// promptForUpdateAction prompts the user for permission to apply an update
func (u *Updater) promptForUpdateAction(ctx Context, update Update, options UpdateOptions) (UpdatePromptResponse, error) {
	u.log.Debug("Prompt for update")

	auto, autoSet := u.config.GetUpdateAuto()
	autoOverride := u.config.GetUpdateAutoOverride()
	u.log.Debugf("Auto update: %s (set=%s autoOverride=%s)", strconv.FormatBool(auto), strconv.FormatBool(autoSet), strconv.FormatBool(autoOverride))
	if auto && !autoOverride {
		if !ctx.IsCheckCommand() {
			// If there's an error getting active status, we'll just update
			isActive, err := u.checkUserActive(ctx)
			if err == nil && isActive {
				return UpdatePromptResponse{UpdateActionUIBusy, false, 0}, nil
			}
			u.guiBusyCount = 0
		}
		return UpdatePromptResponse{UpdateActionAuto, false, 0}, nil
	}

	updateUI := ctx.GetUpdateUI()

	// If auto update never set, default to true
	autoUpdate := auto || !autoSet
	promptOptions := UpdatePromptOptions{AutoUpdate: autoUpdate}
	updatePromptResponse, err := updateUI.UpdatePrompt(update, options, promptOptions)
	if err != nil {
		return UpdatePromptResponse{UpdateActionError, false, 0}, err
	}
	if updatePromptResponse == nil {
		return UpdatePromptResponse{UpdateActionError, false, 0}, fmt.Errorf("No response")
	}

	if updatePromptResponse.Action != UpdateActionContinue {
		u.log.Debugf("Update prompt response: %#v", updatePromptResponse)
		if err := u.config.SetUpdateAuto(updatePromptResponse.AutoUpdate); err != nil {
			u.log.Warningf("Error setting auto preference: %s", err)
			ctx.ReportError(configErr(fmt.Errorf("Error setting auto preference: %s", err)), &update, options)
		}
	}

	return *updatePromptResponse, nil
}

type guiAppState struct {
	IsUserActive bool  `json:"isUserActive"`
	ChangedAtMs  int64 `json:"changedAtMs"`
}

func (u *Updater) checkUserActive(ctx Context) (bool, error) {
	if time.Duration(u.guiBusyCount)*u.tickDuration >= time.Hour*6 { // Allow the update through after 6 hours
		u.log.Warningf("Waited for GUI %d times - ignoring busy", u.guiBusyCount)
		return false, nil
	}

	// Read app-state.json, written by the GUI
	rawState, err := util.ReadFile(ctx.GetAppStatePath())
	if err != nil {
		u.log.Warningf("Error reading GUI state - proceeding", err)
		return false, err
	}

	guistate := guiAppState{}
	if err = json.Unmarshal(rawState, &guistate); err != nil {
		u.log.Warningf("Error parsing GUI state - proceeding", err)
		return false, err
	}
	// check if the user is currently active or was active in the last 5
	// minutes.
	isActive := guistate.IsUserActive || time.Since(time.Unix(guistate.ChangedAtMs/1000, 0)) <= time.Minute*5
	if isActive {
		u.guiBusyCount++
		u.log.Infof("GUI busy on attempt %d", u.guiBusyCount)
	}

	return isActive, nil
}

func report(ctx Context, err error, update *Update, options UpdateOptions) {
	if err != nil {
		// Don't report cancels or GUI busy
		if e, ok := err.(Error); ok {
			if e.IsCancel() || e.IsGUIBusy() {
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

var tempDirRE = regexp.MustCompile(`^KeybaseUpdater.([ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]{52}|\d{18,})$`)

// CleanupPreviousUpdates removes temporary files from previous updates.
func (u *Updater) CleanupPreviousUpdates() (err error) {
	parent := os.TempDir()
	if parent == "" || parent == "." {
		return fmt.Errorf("temp directory is '%v'", parent)
	}
	files, err := os.ReadDir(parent)
	if err != nil {
		return fmt.Errorf("listing parent directory: %v", err)
	}
	for _, fi := range files {
		if !fi.IsDir() {
			continue
		}
		if tempDirRE.MatchString(fi.Name()) {
			targetPath := filepath.Join(parent, fi.Name())
			u.log.Debugf("Cleaning old download: %v", targetPath)
			err = os.RemoveAll(targetPath)
			if err != nil {
				u.log.Infof("Error deleting old temp dir %v: %v", fi.Name(), err)
			}
		}
	}
	return nil
}

// Cleanup removes temporary files from this update
func (u *Updater) Cleanup(tmpDir string) {
	if tmpDir != "" {
		u.log.Debugf("Remove temporary directory: %q", tmpDir)
		if err := os.RemoveAll(tmpDir); err != nil {
			u.log.Warningf("Error removing temporary directory %q: %s", tmpDir, err)
		}
	}
}

// Inspect previously downloaded updates to avoid redownloading
func (u *Updater) FindDownloadedAsset(assetName string) (matchingAssetPath string, err error) {
	if assetName == "" {
		return "", fmt.Errorf("No asset name provided")
	}
	parent := os.TempDir()
	if parent == "" || parent == "." {
		return matchingAssetPath, fmt.Errorf("temp directory is %v", parent)
	}

	files, err := os.ReadDir(parent)
	if err != nil {
		return matchingAssetPath, fmt.Errorf("listing parent directory: %v", err)
	}

	for _, fi := range files {
		if !fi.IsDir() || !tempDirRE.MatchString(fi.Name()) {
			continue
		}

		keybaseTempDirAbs := filepath.Join(parent, fi.Name())
		walkErr := filepath.Walk(keybaseTempDirAbs, func(fullPath string, info os.FileInfo, inErr error) (err error) {
			if inErr != nil {
				return inErr
			}

			if info.IsDir() {
				if fullPath == keybaseTempDirAbs {
					return nil
				}
				return filepath.SkipDir
			}

			path := strings.TrimPrefix(fullPath, keybaseTempDirAbs+string(filepath.Separator))
			if path == assetName {
				matchingAssetPath = fullPath
				return filepath.SkipDir
			}

			return nil
		})

		if walkErr != nil {
			return "", walkErr
		}
	}
	return matchingAssetPath, nil
}
