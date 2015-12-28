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
	"runtime"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	zip "github.com/keybase/client/go/tools/zip"
	"github.com/keybase/client/go/updater/sources"
	"golang.org/x/net/context"
)

type Updater struct {
	libkb.Contextified
	options keybase1.UpdateOptions
	source  sources.UpdateSource
}

func NewUpdater(g *libkb.GlobalContext, options keybase1.UpdateOptions, source sources.UpdateSource) Updater {
	g.Log.Debug("New updater with options: %#v", options)
	return Updater{
		Contextified: libkb.NewContextified(g),
		options:      options,
		source:       source,
	}
}

func NewDefaultUpdater(g *libkb.GlobalContext) *Updater {
	options := DefaultUpdaterOptions(g)
	if options == nil {
		g.Log.Info("No updater available for this environment")
		return nil
	}
	source := sources.DefaultUpdateSource(g)
	if source == nil {
		g.Log.Info("No updater source available for this environment")
		return nil
	}
	updater := NewUpdater(g, *options, source)
	return &updater
}

func (u Updater) Options() keybase1.UpdateOptions {
	return u.options
}

func (u *Updater) CheckForUpdate(skipAssetDownload bool, force bool, requested bool) (update *keybase1.Update, err error) {
	u.G().Log.Info("Checking for update, current version is %s", u.options.Version)

	if u.options.Force {
		force = true
	}

	// Don't snooze if the user requested/wants an update (check)
	if !requested && !force {
		if snz := u.G().Env.GetUpdatePreferenceSnoozeUntil(); snz > 0 {
			snoozeUntil := keybase1.FromTime(snz)
			if time.Now().Before(snoozeUntil) {
				u.G().Log.Info("Snoozing until %s", snoozeUntil)
				return nil, nil
			}
			u.G().Log.Debug("Snooze expired at %s", snoozeUntil)
			// Clear out the snooze
			u.G().Env.GetConfigWriter().SetUpdatePreferenceSnoozeUntil(keybase1.Time(0))
		}
	}

	currentSemVersion, err := semver.Make(u.options.Version)
	if err != nil {
		return
	}

	u.G().Log.Info("Using updater source: %s", u.source.Description())
	u.G().Log.Debug("Using options: %#v", u.options)
	update, err = u.source.FindUpdate(u.options)
	if err != nil || update == nil {
		return
	}

	u.G().Log.Info("Checking update with version: %s", update.Version)
	updateSemVersion, err := semver.Make(update.Version)
	if err != nil {
		return
	}

	if skp := u.G().Env.GetUpdatePreferenceSkip(); len(skp) != 0 {
		u.G().Log.Debug("Update preference: skip %s", skp)
		if vers, err := semver.Make(skp); err != nil {
			u.G().Log.Warning("Bad 'skipVersion' in config file: %q", skp)
		} else if vers.GE(updateSemVersion) {
			u.G().Log.Debug("Skipping updated version via config preference: %q", update.Version)
			return nil, nil
		}
	}

	if updateSemVersion.EQ(currentSemVersion) {
		// Versions are the same, we are up to date
		u.G().Log.Info("Update matches current version: %s = %s", updateSemVersion, currentSemVersion)
		if !force {
			update = nil
			return
		}
	} else if updateSemVersion.LT(currentSemVersion) {
		u.G().Log.Info("Update is older version: %s < %s", updateSemVersion, currentSemVersion)
		if !force {
			err = fmt.Errorf("Update is older version: %s < %s", updateSemVersion, currentSemVersion)
			update = nil
			return
		}
	}

	if !skipAssetDownload {
		downloadPath, _, dlerr := u.downloadAsset(update.Asset)
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

func (u *Updater) pathForFilename(filename string) string {
	return filepath.Join(os.TempDir(), "KeybaseUpdates", filename)
}

func (u *Updater) downloadAsset(asset keybase1.Asset) (fpath string, cached bool, err error) {
	url, err := url.Parse(asset.Url)
	if err != nil {
		return
	}

	if url.Scheme == "file" {
		// This is only used for testing, where "file://" is hardcoded.
		// "file:\\" doesn't work on Windows here.
		fpath = asset.Url[7:]
		u.G().Log.Info("Using local path: %s", fpath)
		return
	}

	filename := asset.Name
	fpath = u.pathForFilename(filename)
	err = libkb.MakeParentDirs(fpath)
	if err != nil {
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
		u.G().Log.Info("Using etag: %s", etag)
		req.Header.Set("If-None-Match", etag)
	}
	timeout := time.Duration(20 * time.Minute)
	client := &http.Client{
		Timeout: timeout,
	}
	u.G().Log.Info("Request %s", url.String())
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		cached = true
		return
	}
	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Responded with %s", resp.Status)
		return
	}

	savePath := fmt.Sprintf("%s.download", fpath)
	if _, err = os.Stat(savePath); err == nil {
		u.G().Log.Info("Removing existing partial download: %s", savePath)
		err = os.Remove(savePath)
		if err != nil {
			return
		}
	}
	file, err := os.OpenFile(savePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, libkb.PermFile)
	if err != nil {
		return
	}
	defer file.Close()
	u.G().Log.Info("Saving to %s", fpath)
	n, err := io.Copy(file, resp.Body)
	u.G().Log.Info("Wrote %d bytes", n)
	if err != nil {
		return
	}

	if _, err = os.Stat(fpath); err == nil {
		u.G().Log.Info("Removing existing download: %s", fpath)
		err = os.Remove(fpath)
		if err != nil {
			return
		}
	}
	u.G().Log.Info("Moving %s to %s", filepath.Base(savePath), filepath.Base(fpath))
	err = os.Rename(savePath, fpath)
	return
}

func (u *Updater) unpack(filename string) (string, error) {
	u.G().Log.Debug("unpack %s", filename)
	if !strings.HasSuffix(filename, ".zip") {
		u.G().Log.Debug("File isn't compressed, so won't unzip: %q", filename)
		return filename, nil
	}

	unzipDest := fmt.Sprintf("%s.unzipped", filename)
	u.G().Log.Info("Unzipping %q -> %q", filename, unzipDest)
	err := zip.Unzip(filename, unzipDest)
	if err != nil {
		return "", err
	}

	return unzipDest, nil
}

func (u *Updater) checkUpdate(sourcePath string, destinationPath string) error {
	u.G().Log.Info("Checking update for %s", destinationPath)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return err
	}

	destFileInfo, err := os.Lstat(destinationPath)
	if os.IsNotExist(err) {
		u.G().Log.Info("Existing destination doesn't exist")
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

func (u *Updater) apply(src string, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		tmpFileName, err := libkb.TempFileName(fmt.Sprintf("%s.", filepath.Base(dest)))
		if err != nil {
			return err
		}
		tmpPath := filepath.Join(os.TempDir(), "KeybaseBackup", tmpFileName)
		err = libkb.MakeParentDirs(tmpPath)
		if err != nil {
			return err
		}
		u.G().Log.Info("Moving (existing) %s to %s", dest, tmpPath)
		err = os.Rename(dest, tmpPath)
		if err != nil {
			return err
		}
	}

	u.G().Log.Info("Moving (update) %s to %s", src, dest)
	err := os.Rename(src, dest)
	if err != nil {
		return err
	}

	return nil
}

// Update checks, downloads and performs an update.
func (u *Updater) Update(ui libkb.UpdateUI, force bool, requested bool) (update *keybase1.Update, err error) {
	update, err = u.CheckForUpdate(false, force, requested)
	if err != nil {
		return
	}
	if update == nil {
		// No update available
		return
	}

	err = u.ApplyUpdate(ui, *update, force)
	if err != nil {
		return
	}

	_, err = u.Restart(ui)
	return
}

func (u *Updater) PromptForUpdateAction(ui libkb.UpdateUI, update keybase1.Update) (err error) {

	u.G().Log.Debug("+ Update.PromptForUpdateAction")
	defer func() {
		u.G().Log.Debug("- Update.PromptForUpdateAction -> %v", err)
	}()

	if auto := u.G().Env.GetUpdatePreferenceAuto(); auto {
		u.G().Log.Debug("| going ahead with auto-updates")
		return
	}

	if ui == nil {
		err = libkb.NoUIError{Which: "Update"}
		return
	}

	updatePromptResponse, err := ui.UpdatePrompt(context.TODO(), keybase1.UpdatePromptArg{Update: update})
	if err != nil {
		return
	}
	configWriter := u.G().Env.GetConfigWriter()

	if updatePromptResponse.AlwaysAutoInstall {
		configWriter.SetUpdatePreferenceAuto(true)
	}
	switch updatePromptResponse.Action {
	case keybase1.UpdateAction_UPDATE:
	case keybase1.UpdateAction_SKIP:
		err = libkb.CanceledError{M: "skipped update"}
		configWriter.SetUpdatePreferenceSkip(update.Version)
	case keybase1.UpdateAction_SNOOZE:
		err = libkb.CanceledError{M: "snoozed update"}
		configWriter.SetUpdatePreferenceSnoozeUntil(updatePromptResponse.SnoozeUntil)
	case keybase1.UpdateAction_CANCEL:
		err = libkb.CanceledError{M: "canceled update"}
	default:
		err = libkb.CanceledError{M: "unexpected cancelation"}
	}
	return
}

func (u *Updater) ApplyUpdate(ui libkb.UpdateUI, update keybase1.Update, force bool) (err error) {
	if u.options.Force {
		force = true
	}
	if !force {
		if err = u.PromptForUpdateAction(ui, update); err != nil {
			return
		}
	}

	if update.Asset.LocalPath == "" {
		err = fmt.Errorf("No local asset path for update")
		return
	}

	unzipPath, err := u.unpack(update.Asset.LocalPath)
	if err != nil {
		return
	}
	u.G().Log.Info("Unzip path: %s", unzipPath)

	baseName := filepath.Base(u.options.DestinationPath)
	sourcePath := filepath.Join(unzipPath, baseName)
	err = u.checkUpdate(sourcePath, u.options.DestinationPath)
	if err != nil {
		return
	}

	err = u.apply(sourcePath, u.options.DestinationPath)
	if err != nil {
		return
	}

	// TODO: On OSX call mdimport so Spotlight knows it changed?

	return
}

func (u *Updater) Restart(ui libkb.UpdateUI) (didQuit bool, err error) {
	if ui == nil {
		err = libkb.NoUIError{Which: "Update"}
		return
	}

	u.G().Log.Info("Restarting app")
	u.G().Log.Debug("Asking if it safe to quit the app")
	updateQuitResponse, err := ui.UpdateQuit(context.TODO())
	if err != nil {
		return
	}

	if !updateQuitResponse.Quit {
		u.G().Log.Warning("App quit (for restart) was canceled or unsupported after update")
		return
	}

	if updateQuitResponse.Pid == 0 {
		err = fmt.Errorf("Invalid PID: %d", updateQuitResponse.Pid)
		return
	}

	u.G().Log.Debug("App reported its PID as %d", updateQuitResponse.Pid)
	p, err := os.FindProcess(updateQuitResponse.Pid)
	if err != nil {
		return
	}
	u.G().Log.Debug("Killing app")
	err = p.Kill()
	if err != nil {
		return
	}
	didQuit = true

	u.G().Log.Debug("Opening app at %s", updateQuitResponse.ApplicationPath)
	err = openApplication(updateQuitResponse.ApplicationPath)
	if err != nil {
		return
	}

	return
}

// DefaultUpdaterOptions returns update config for this environment
func DefaultUpdaterOptions(g *libkb.GlobalContext) *keybase1.UpdateOptions {
	ret := &keybase1.UpdateOptions{
		Version:  libkb.VersionString(),
		Channel:  "main", // The default channel
		Platform: runtime.GOOS,
	}
	switch {
	case runtime.GOOS == "darwin" && g.Env.GetRunMode() == libkb.ProductionRunMode:
		ret.DestinationPath = "/Applications/Keybase.app"
	}
	return ret
}
