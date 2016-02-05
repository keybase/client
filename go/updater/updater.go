// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	zip "github.com/keybase/client/go/tools/zip"
	"github.com/keybase/client/go/updater/sources"
	"golang.org/x/net/context"
)

type Updater struct {
	options      keybase1.UpdateOptions
	source       sources.UpdateSource
	config       Config
	log          logger.Logger
	callGroup    Group
	cancelPrompt context.CancelFunc
}

type UI interface {
	GetUpdateUI() (libkb.UpdateUI, error)
}

type Config interface {
	GetUpdatePreferenceAuto() (bool, bool)
	GetUpdatePreferenceSnoozeUntil() keybase1.Time
	GetUpdatePreferenceSkip() string
	GetUpdateLastChecked() keybase1.Time
	SetUpdatePreferenceAuto(b bool) error
	SetUpdatePreferenceSkip(v string) error
	SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error
	SetUpdateLastChecked(t keybase1.Time) error
	GetRunModeAsString() string
}

func NewUpdater(options keybase1.UpdateOptions, source sources.UpdateSource, config Config, log logger.Logger) *Updater {
	log.Debug("New updater with options: %#v", options)
	return &Updater{
		options: options,
		source:  source,
		config:  config,
		log:     log,
	}
}

func (u *Updater) Options() keybase1.UpdateOptions {
	return u.options
}

func (u *Updater) checkForUpdate(skipAssetDownload bool, force bool, requested bool) (update *keybase1.Update, err error) {
	u.log.Info("Checking for update, current version is %s", u.options.Version)

	if u.options.Force {
		force = true
	}

	// Don't snooze if the user requested/wants an update (check) or we're forcing a check
	if !requested && !force {
		if snz := u.config.GetUpdatePreferenceSnoozeUntil(); snz > 0 {
			snoozeUntil := keybase1.FromTime(snz)
			if time.Now().Before(snoozeUntil) {
				u.log.Info("Snoozing until %s", snoozeUntil)
				return nil, nil
			}
			u.log.Debug("Snooze expired at %s", snoozeUntil)
			// Clear out the snooze
			u.config.SetUpdatePreferenceSnoozeUntil(keybase1.Time(0))
		}
	}

	currentSemVersion, err := semver.Make(u.options.Version)
	if err != nil {
		return
	}

	u.log.Info("Using updater source: %s", u.source.Description())
	u.log.Debug("Using options: %#v", u.options)
	update, err = u.source.FindUpdate(u.options)
	if err != nil || update == nil {
		return
	}

	u.log.Info("Checking update with version: %s", update.Version)
	updateSemVersion, err := semver.Make(update.Version)
	if err != nil {
		return
	}

	// Update instruction might be empty, if so we'll fill in with the default
	// instructions for the platform.
	if update.Instructions == nil || *update.Instructions == "" {
		instructions, err := libkb.PlatformSpecificUpgradeInstructionsString()
		if err != nil {
			u.log.Errorf("Error trying to get update instructions: %s", err)
		}
		if instructions == "" {
			instructions = u.options.DefaultInstructions
		}
		if instructions != "" {
			u.log.Debug("Using default platform instructions: %s", instructions)
			update.Instructions = &instructions
		} else {
			u.log.Debug("No instructions set for update")
		}
	}

	if skipVersion := u.config.GetUpdatePreferenceSkip(); len(skipVersion) != 0 {
		u.log.Debug("Update preference: skip %s", skipVersion)
		if vers, err := semver.Make(skipVersion); err != nil {
			u.log.Warning("Bad 'skipVersion' in config file: %q", skipVersion)
		} else if vers.GE(updateSemVersion) {
			u.log.Debug("Skipping updated version via config preference: %q", update.Version)
			return nil, nil
		}
	}

	if updateSemVersion.EQ(currentSemVersion) {
		// Versions are the same, we are up to date
		u.log.Info("Update matches current version: %s = %s", updateSemVersion, currentSemVersion)
		if !force {
			update = nil
			return
		}
	} else if updateSemVersion.LT(currentSemVersion) {
		u.log.Info("Update is older version: %s < %s", updateSemVersion, currentSemVersion)
		if !force {
			update = nil
			return
		}
	}

	if !skipAssetDownload && update.Asset != nil {
		downloadPath, _, dlerr := u.downloadAsset(*update.Asset)
		if dlerr != nil {
			err = dlerr
			return
		}
		update.Asset.LocalPath = downloadPath
	}

	return
}

func computeEtag(path string) (string, error) {
	var result []byte
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(result)), nil
}

func (u *Updater) checkDigest(digest string, localPath string) error {
	if digest == "" {
		return fmt.Errorf("Missing digest")
	}
	calcDigest, err := libkb.DigestForFileAtPath(localPath)
	if err != nil {
		return err
	}
	if calcDigest != digest {
		return fmt.Errorf("Invalid digest: %s != %s (%s)", calcDigest, digest, localPath)
	}
	u.log.Info("Verified digest: %s (%s)", digest, localPath)
	return nil
}

func (u *Updater) downloadAsset(asset keybase1.Asset) (fpath string, cached bool, err error) {
	url, err := url.Parse(asset.Url)
	if err != nil {
		return
	}

	filename := asset.Name
	fpath = pathForUpdaterFilename(filename)
	err = libkb.MakeParentDirs(fpath)
	if err != nil {
		return
	}

	if url.Scheme == "file" {
		// This is only used for testing, where "file://" is hardcoded.
		// "file:\\" doesn't work on Windows here.
		localpath := asset.Url[7:]

		err = copyFile(localpath, fpath)
		if err != nil {
			return
		}

		if derr := u.checkDigest(asset.Digest, fpath); derr != nil {
			err = derr
			return
		}

		u.log.Info("Using local path: %s", fpath)
		return
	}

	etag := ""
	if _, err = os.Stat(fpath); err == nil {
		etag, err = computeEtag(fpath)
		if err != nil {
			return
		}
	}

	req, _ := http.NewRequest("GET", url.String(), nil)
	if etag != "" {
		u.log.Info("Using etag: %s", etag)
		req.Header.Set("If-None-Match", etag)
	}
	timeout := time.Duration(20 * time.Minute)
	client := &http.Client{
		Timeout: timeout,
	}
	u.log.Info("Request %s", url.String())
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	if resp == nil {
		err = fmt.Errorf("No response")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		u.log.Info("Using cached file: %s", fpath)
		cached = true
		return
	}
	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Responded with %s", resp.Status)
		return
	}

	savePath := fmt.Sprintf("%s.download", fpath)
	if _, ferr := os.Stat(savePath); ferr == nil {
		u.log.Info("Removing existing partial download: %s", savePath)
		err = os.Remove(savePath)
		if err != nil {
			return
		}
	}

	err = u.save(savePath, *resp)
	if err != nil {
		return
	}

	if derr := u.checkDigest(asset.Digest, savePath); derr != nil {
		err = derr
		return
	}

	if _, err = os.Stat(fpath); err == nil {
		u.log.Info("Removing existing download: %s", fpath)
		err = os.Remove(fpath)
		if err != nil {
			return
		}
	}

	u.log.Info("Moving %s to %s", filepath.Base(savePath), filepath.Base(fpath))

	err = os.Rename(savePath, fpath)
	return
}

func (u *Updater) save(savePath string, resp http.Response) error {
	file, err := os.OpenFile(savePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, libkb.PermFile)
	if err != nil {
		return err
	}
	defer file.Close()

	u.log.Info("Downloading to %s", savePath)
	n, err := io.Copy(file, resp.Body)
	if err == nil {
		u.log.Info("Downloaded %d bytes", n)
	}
	return err
}

func (u *Updater) unpack(filename string) (string, error) {
	u.log.Debug("Unpack %s", filename)
	if !strings.HasSuffix(filename, ".zip") {
		u.log.Errorf("Don't know how to unpack: %s", filename)
		return "", nil
	}

	unzipDestination := unzipDestination(filename)
	if _, ferr := os.Stat(unzipDestination); ferr == nil {
		u.log.Info("Removing existing unzip destination: %s", unzipDestination)
		err := os.RemoveAll(unzipDestination)
		if err != nil {
			return "", nil
		}
	}

	u.log.Info("Unzipping %q -> %q", filename, unzipDestination)
	err := zip.Unzip(filename, unzipDestination)
	if err != nil {
		return "", err
	}

	return unzipDestination, nil
}

func (u *Updater) checkUpdate(sourcePath string, destinationPath string) error {
	u.log.Info("Checking update for %s", destinationPath)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return err
	}

	destFileInfo, err := os.Lstat(destinationPath)
	if os.IsNotExist(err) {
		u.log.Info("Existing destination doesn't exist")
		return nil
	}

	if err != nil {
		return err
	}
	// Make sure destination is not a link
	if destFileInfo.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("Destination is a symbolic link")
	}
	if !destFileInfo.Mode().IsDir() {
		return fmt.Errorf("Destination is a directory")
	}

	return u.checkPlatformSpecificUpdate(sourcePath, destinationPath)
}

func (u *Updater) apply(src string, dest string) (tmpPath string, err error) {
	if _, sterr := os.Stat(dest); sterr == nil {
		tmpFileName, terr := libkb.TempFileName(fmt.Sprintf("%s.", filepath.Base(dest)))
		if terr != nil {
			err = terr
			return
		}
		tmpPath = filepath.Join(backupDir(), tmpFileName)
		err = libkb.MakeParentDirs(tmpPath)
		if err != nil {
			return
		}
		u.log.Info("Moving (existing) %s to %s", dest, tmpPath)

		err = os.Rename(dest, tmpPath)
		// If we error trying to remove existing destination, let's try using
		// a platform dependent (privileged) way.
		// To test this (on OS X), chown -R root:admin /Applications/Keybase and
		// perform an update.
		if err != nil {
			platformRemoveErr := u.removeApp(dest)
			if platformRemoveErr != nil {
				// We failed to remove via platform too, return (original) err
				return
			}
		}
	}

	u.log.Info("Moving (update) %s to %s", src, dest)
	err = os.Rename(src, dest)
	return
}

// Update checks, downloads and performs an update.
func (u *Updater) Update(ui UI, force bool, requested bool) (update *keybase1.Update, err error) {
	update, skipped, err := u.updateSingleFlight(ui, force, requested)
	// Retry if skipped via singleflight
	if skipped {
		update, _, err = u.updateSingleFlight(ui, force, requested)
	}
	return
}

func (u *Updater) updateSingleFlight(ui UI, force bool, requested bool) (*keybase1.Update, bool, error) {
	if u.cancelPrompt != nil {
		u.log.Info("Canceling update that was waiting on a prompt")
		u.cancelPrompt()
	}

	do := func() (interface{}, error) {
		return u.update(ui, force, requested)
	}
	any, cached, err := u.callGroup.Do("update", do)
	if cached {
		u.log.Info("There was an update already in progress")
		return nil, true, nil
	}

	update, ok := any.(*keybase1.Update)
	if !ok {
		return nil, false, fmt.Errorf("Invalid type returned by updater singleflight")
	}
	return update, false, err
}

func (u *Updater) update(ui UI, force bool, requested bool) (update *keybase1.Update, err error) {
	update, err = u.checkForUpdate(false, force, requested)
	if err != nil {
		return
	}
	if update == nil {
		// No update available
		return
	}

	if err = u.promptForUpdateAction(ui, *update); err != nil {
		return
	}

	if update.Asset == nil {
		u.log.Info("No update asset to apply")
		return
	}

	if update.Asset.LocalPath == "" {
		err = fmt.Errorf("No local asset path for update")
		return
	}

	tmpFileName, err := u.applyUpdate(update.Asset.LocalPath)
	if err != nil {
		return
	}

	_, err = u.restart(ui)

	if update.Asset != nil {
		u.cleanup([]string{unzipDestination(update.Asset.LocalPath), update.Asset.LocalPath})
		return
	}

	if tmpFileName != "" {
		u.cleanup([]string{tmpFileName})
	}

	return
}

func (u *Updater) promptForUpdateAction(ui UI, update keybase1.Update) (err error) {

	u.log.Debug("+ Updater.promptForUpdateAction")
	defer func() {
		u.log.Debug("- Updater.promptForUpdateAction -> %v", err)
	}()

	auto, autoSet := u.config.GetUpdatePreferenceAuto()
	if auto {
		u.log.Debug("| going ahead with auto-updates")
		return
	}

	if ui == nil {
		err = libkb.NoUIError{Which: "Update"}
		return
	}

	updateUI, err := u.waitForUI(ui, 5*time.Second)
	if err != nil {
		return
	}

	// If automatically apply not set, default to true
	alwaysAutoInstall := !autoSet

	updatePromptArg := keybase1.UpdatePromptArg{
		Update: update,
		Options: keybase1.UpdatePromptOptions{
			AlwaysAutoInstall: alwaysAutoInstall,
		},
	}
	updateContext, canceler := context.WithCancel(context.Background())
	u.cancelPrompt = canceler
	updatePromptResponse, err := updateUI.UpdatePrompt(updateContext, updatePromptArg)
	u.cancelPrompt = nil
	if err != nil {
		return
	}

	u.log.Debug("Update prompt response: %#v", updatePromptResponse)
	u.config.SetUpdatePreferenceAuto(updatePromptResponse.AlwaysAutoInstall)
	switch updatePromptResponse.Action {
	case keybase1.UpdateAction_UPDATE:
	case keybase1.UpdateAction_SKIP:
		err = libkb.CanceledError{M: "skipped update"}
		u.config.SetUpdatePreferenceSkip(update.Version)
	case keybase1.UpdateAction_SNOOZE:
		err = libkb.CanceledError{M: "snoozed update"}
		u.config.SetUpdatePreferenceSnoozeUntil(updatePromptResponse.SnoozeUntil)
	case keybase1.UpdateAction_CANCEL:
		err = libkb.CanceledError{M: "canceled update"}
	default:
		err = libkb.CanceledError{M: "unexpected cancelation"}
	}
	return
}

func (u *Updater) applyZip(localPath string, destinationPath string) (tmpPath string, err error) {
	unzipPath, err := u.unpack(localPath)
	if err != nil {
		return
	}
	u.log.Info("Unzip path: %s", unzipPath)

	baseName := filepath.Base(destinationPath)
	sourcePath := filepath.Join(unzipPath, baseName)
	err = u.checkUpdate(sourcePath, destinationPath)
	if err != nil {
		return
	}

	tmpPath, err = u.apply(sourcePath, destinationPath)
	if err != nil {
		return
	}

	return
}

func (u *Updater) restart(ui UI) (didQuit bool, err error) {
	if ui == nil {
		err = libkb.NoUIError{Which: "Update"}
		return
	}

	u.log.Info("Restarting app")
	u.log.Debug("Asking if it safe to quit the app")
	updateUI, err := u.waitForUI(ui, 5*time.Second)
	if err != nil {
		return
	}
	updateQuitResponse, err := updateUI.UpdateQuit(context.TODO())
	if err != nil {
		return
	}

	if !updateQuitResponse.Quit {
		u.log.Warning("App quit (for restart) was canceled or unsupported after update")
		return
	}

	if updateQuitResponse.Pid == 0 {
		err = fmt.Errorf("Invalid PID: %d", updateQuitResponse.Pid)
		return
	}

	u.log.Debug("App reported its PID as %d", updateQuitResponse.Pid)
	p, err := os.FindProcess(updateQuitResponse.Pid)
	if err != nil {
		return
	}
	u.log.Debug("Killing app")
	err = p.Kill()
	if err != nil {
		return
	}
	didQuit = true

	u.log.Debug("Opening app at %s", updateQuitResponse.ApplicationPath)
	err = openApplication(updateQuitResponse.ApplicationPath)
	if err != nil {
		return
	}

	return
}

func (u *Updater) cleanup(files []string) {
	u.log.Debug("Cleaning up after update")
	for _, f := range files {
		u.log.Debug("Removing %s", f)
		if f != "" {
			err := os.RemoveAll(f)
			if err != nil {
				u.log.Warning("Error trying to remove file (cleaning up after update): %s", err)
			}
		}
	}
}

func pathForUpdaterFilename(filename string) string {
	return filepath.Join(os.TempDir(), "KeybaseUpdates", filename)
}

func backupDir() string {
	return filepath.Join(os.TempDir(), "KeybaseBackup")
}

func unzipDestination(filename string) string {
	return fmt.Sprintf("%s.unzipped", filename)
}

func copyFile(sourcePath string, destinationPath string) error {
	in, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(destinationPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	cerr := out.Close()
	if err != nil {
		return err
	}
	return cerr
}

// waitForUI waits for a UI to be available. A UI might be missing for a few
// seconds between restarts.
func (u *Updater) waitForUI(ui UI, wait time.Duration) (updateUI libkb.UpdateUI, err error) {
	t := time.Now()
	i := 1
	for time.Now().Sub(t) < wait {
		updateUI, err = ui.GetUpdateUI()
		if err != nil || updateUI != nil {
			return
		}
		// Tell user we're waiting for UI after 4 seconds, every 4 seconds
		if i%4 == 0 {
			u.log.Info("Waiting for UI to be available...")
		}
		time.Sleep(time.Second)
		i++
	}
	return nil, fmt.Errorf("No UI available for updater")
}
