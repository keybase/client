// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"runtime"
	"strings"
	"time"

	"github.com/keybase/client/go/install/sources"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	zip "github.com/keybase/client/go/tools/zip"
	context "golang.org/x/net/context"

	"github.com/blang/semver"
)

type Updater struct {
	libkb.Contextified
	config keybase1.UpdateConfig
	source sources.UpdateSource
	ticker *time.Ticker
}

func NewUpdater(g *libkb.GlobalContext, config keybase1.UpdateConfig, source sources.UpdateSource) Updater {
	g.Log.Debug("New updater with config: %#v", config)
	return Updater{
		Contextified: libkb.NewContextified(g),
		config:       config,
		source:       source,
	}
}

func (u Updater) Config() keybase1.UpdateConfig {
	return u.config
}

func (u *Updater) CheckForUpdate() (update *keybase1.Update, err error) {
	u.G().Log.Info("Checking for update, current version is %s", u.config.Version)

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

	currentSemVersion, err := semver.Make(u.config.Version)
	if err != nil {
		return
	}

	update, err = u.source.FindUpdate(u.config)
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
		if !u.config.Force {
			update = nil
		}
		return
	} else if updateSemVersion.LT(currentSemVersion) {
		err = fmt.Errorf("Update is older version: %s < %s", updateSemVersion, currentSemVersion)
		return
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
	return path.Join(os.TempDir(), "KeybaseUpdates", filename)
}

func (u *Updater) downloadAsset(asset keybase1.Asset) (fpath string, cached bool, err error) {
	url, err := url.Parse(asset.Url)
	if err != nil {
		return
	}

	if url.Scheme == "file" {
		fpath = url.Path
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
	u.G().Log.Info("Moving %s to %s", path.Base(savePath), path.Base(fpath))
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
		tmpFileName, err := libkb.TempFileName(fmt.Sprintf("%s.", path.Base(dest)))
		if err != nil {
			return err
		}
		tmpPath := path.Join(os.TempDir(), "KeybaseBackup", tmpFileName)
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
func (u *Updater) Update(ui libkb.UpdateUI) (update *keybase1.Update, err error) {
	update, err = u.CheckForUpdate()
	if err != nil {
		return
	}
	if update == nil {
		// No update available
		return
	}

	err = u.ApplyUpdate(ui, *update)
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
		err = libkb.NoUIError{Which: "UpdateUI"}
		return
	}

	updatePrompt := keybase1.UpdatePromptArg{Update: update}
	var updatePromptResponse keybase1.UpdatePromptRes

	updatePromptResponse, err = ui.UpdatePrompt(context.TODO(), updatePrompt)
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

func (u *Updater) ApplyUpdate(ui libkb.UpdateUI, update keybase1.Update) (err error) {
	downloadPath, _, err := u.downloadAsset(update.Asset)
	if err != nil {
		return
	}

	if u.config.Force {
		u.G().Log.Info("Forcing update")
	} else {
		if err = u.PromptForUpdateAction(ui, update); err != nil {
			return err
		}
	}

	unzipPath, err := u.unpack(downloadPath)
	if err != nil {
		return
	}
	u.G().Log.Info("Unzip path: %s", unzipPath)

	baseName := path.Base(u.config.DestinationPath)
	sourcePath := path.Join(unzipPath, baseName)
	err = u.checkUpdate(sourcePath, u.config.DestinationPath)
	if err != nil {
		return
	}

	err = u.apply(sourcePath, u.config.DestinationPath)
	if err != nil {
		return
	}

	// TODO: On OSX call mdimport so Spotlight knows it changed?

	return
}

// DefaultUpdaterConfig returns update config for this environment
func DefaultUpdaterConfig(g *libkb.GlobalContext) *keybase1.UpdateConfig {
	ret := &keybase1.UpdateConfig{
		Version: libkb.VersionString(),
		Channel: "main", // The default channel
	}
	switch {
	case runtime.GOOS == "darwin" && g.Env.GetRunMode() == libkb.ProductionRunMode:
		ret.DestinationPath = "/Applications/Keybase.app"
	}
	return ret
}

var UpdateAutomatically = true
var UpdateCheckDuration = (24 * time.Hour)

func UpdaterStartTicker(g *libkb.GlobalContext) *Updater {
	config := DefaultUpdaterConfig(g)
	if config == nil {
		g.Log.Info("No updater available for this environment")
		return nil
	}
	updater := NewUpdater(g, *config, sources.NewKeybaseUpdateSource(g))
	updater.StartUpdateCheck()
	return &updater
}

func (u *Updater) updateTick() {
	ui, _ := u.G().UIRouter.GetUpdateUI()
	auto := u.G().Env.GetUpdatePreferenceAuto()
	if UpdateAutomatically && (ui != nil || auto) {
		update, err := u.Update(ui)
		if err != nil {
			u.G().Log.Errorf("Error trying to update: %s", err)
		} else if update != nil {
			u.G().Log.Errorf("Applied update: %#v", update)
		}
	} else {
		update, err := u.CheckForUpdate()
		if err != nil {
			u.G().Log.Errorf("Error checking for update: %s", err)
		} else if update != nil {
			// TODO: Notify of update
		}
	}
}

func (u *Updater) StartUpdateCheck() {
	if u.ticker != nil {
		return
	}
	u.ticker = time.NewTicker(UpdateCheckDuration)
	go func() {
		for t := range u.ticker.C {
			u.G().Log.Info("Checking for update (%s)", t)
			u.updateTick()
		}
	}()
}

func (u *Updater) StopUpdateCheck() {
	u.ticker.Stop()
	u.ticker = nil
}
