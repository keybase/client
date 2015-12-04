// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/keybase/client/go/install/sources"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	zip "github.com/keybase/client/go/tools/zip"

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

	currentSemVersion, err := semver.Make(u.config.Version)
	if err != nil {
		return
	}

	update, err = u.source.FindUpdate(u.config)
	if err != nil || update == nil {
		return
	}

	u.G().Log.Info("Found update with version: %s", update.Version)
	updateSemVersion, err := semver.Make(update.Version)
	if err != nil {
		return
	}
	if updateSemVersion.EQ(currentSemVersion) {
		// Versions are the same, we are up to date
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

func isFileScheme(url string) (string, bool) {
	scheme := "file://"
	if strings.HasPrefix(url, scheme) {
		fpath := url[len(scheme):]
		return fpath, true
	}

	return "", false
}

func (u *Updater) downloadAsset(asset keybase1.Asset) (fpath string, cached bool, err error) {
	url := asset.DownloadURL
	if lpath, b := isFileScheme(url); b {
		u.G().Log.Info("Using local path: %s", lpath)
		fpath = lpath
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

	req, _ := http.NewRequest("GET", url, nil)
	u.G().Log.Info("Using etag: %s", etag)
	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}
	client := &http.Client{}
	u.G().Log.Info("Request %#v", url)
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
	file, err := os.OpenFile(savePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, libkb.PermFile)
	if err != nil {
		return
	}
	defer file.Close()
	n, err := io.Copy(file, resp.Body)
	u.G().Log.Info("Saving %d bytes to %s", n, fpath)
	if err != nil {
		return
	}

	if _, err = os.Stat(fpath); err == nil {
		u.G().Log.Info("Removing existing bad download: %s", fpath)
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
	unzipDest := fmt.Sprintf("%s.unzipped", filename)
	u.G().Log.Info("Unzipping %s", filename)
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

	//
	// Get the uid, gid of the destination and make sure our src matches.
	//
	// Updating the modification time of the application is important because the
	// system will be aware a new version of your app is available.
	// Finder will report the correct file size and other metadata for it, URL
	// schemes your app may register will be updated, etc.
	//
	// This might fail if the app is owned by root/admin, in which case we should
	// get the priviledged helper tool involved.
	//

	// Get uid, gid of destination
	uid := destFileInfo.Sys().(*syscall.Stat_t).Uid
	gid := destFileInfo.Sys().(*syscall.Stat_t).Gid
	u.G().Log.Info("Destination: %s, Uid: %d, Gid: %d", destinationPath, uid, gid)

	walk := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		err = os.Chown(path, int(uid), int(gid))
		if err != nil {
			return err
		}
		t := time.Now()
		err = os.Chtimes(path, t, t)
		if err != nil {
			return err
		}
		return nil
	}

	u.G().Log.Info("Touching, chowning files in %s", sourcePath)
	err = filepath.Walk(sourcePath, walk)
	if err != nil {
		return err
	}

	return nil
}

func (u *Updater) apply(src string, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		tmpDirName, err := libkb.TempFile(fmt.Sprintf("%s.", path.Base(dest)))
		if err != nil {
			return err
		}
		u.G().Log.Info("Moving (existing) %s to %s", dest, tmpDirName)
		err = os.Rename(dest, tmpDirName)
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
func (u *Updater) Update() (update *keybase1.Update, err error) {
	update, err = u.CheckForUpdate()
	if err != nil {
		return
	}
	if update == nil {
		// No update available
		return
	}

	err = u.ApplyUpdate(update)
	return
}

func (u *Updater) ApplyUpdate(update *keybase1.Update) (err error) {
	downloadPath, _, err := u.downloadAsset(update.Asset)
	if err != nil {
		return
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
	if runtime.GOOS == "darwin" {
		if g.Env.GetRunMode() == libkb.ProductionRunMode {
			return &keybase1.UpdateConfig{
				DestinationPath: "/Applications/Keybase.app",
				Version:         libkb.VersionString(),
			}
		}
	}
	return nil
}

var UpdateAutomatically = true
var UpdateCheckDuration = (24 * time.Hour)

func UpdaterStartTicker(g *libkb.GlobalContext) *Updater {
	config := DefaultUpdaterConfig(g)
	if config == nil {
		g.Log.Errorf("No updater available for this environment")
		return nil
	}
	updater := NewUpdater(g, *config, sources.NewKeybaseUpdateSource(g))
	updater.StartUpdateCheck()
	return &updater
}

func (u *Updater) updateTick() {
	if UpdateAutomatically {
		update, err := u.Update()
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
