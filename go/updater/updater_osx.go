// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package updater

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"time"
)

func (u *Updater) checkPlatformSpecificUpdate(sourcePath string, destinationPath string) error {
	//
	// Get the uid, gid of the current user and make sure our src matches.
	//
	// Updating the modification time of the application is important because the
	// system will be aware a new version of your app is available.
	// Finder will report the correct file size and other metadata for it, URL
	// schemes your app may register will be updated, etc.
	//
	// This might fail if the app is owned by root/admin, in which case we should
	// get the priviledged helper tool involved.
	//

	// Get uid, gid of current user
	currentUser, err := user.Current()
	if err != nil {
		return err
	}
	uid, err := strconv.Atoi(currentUser.Uid)
	if err != nil {
		return err
	}
	gid, err := strconv.Atoi(currentUser.Gid)
	if err != nil {
		return err
	}

	u.log.Info("Current user uid: %d, gid: %d", uid, gid)

	walk := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		err = os.Chown(path, uid, gid)
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

	u.log.Info("Touching, chowning files in %s", sourcePath)
	err = filepath.Walk(sourcePath, walk)
	if err != nil {
		return err
	}

	return nil
}

func openApplication(applicationPath string) error {
	_, err := exec.Command("/usr/bin/open", applicationPath).Output()
	return err
}

func (u *Updater) applyUpdate(localPath string) (tmpPath string, err error) {
	destinationPath := u.options.DestinationPath
	tmpPath, err = u.applyZip(localPath, destinationPath)
	if err != nil {
		return
	}

	// Update spotlight, ignore (log) errors
	u.log.Debug("Updating spotlight: %s", destinationPath)
	mdimportOut, mdierr := exec.Command("/usr/bin/mdimport", destinationPath).Output()
	if mdierr != nil {
		u.log.Errorf("Error trying to update spotlight: %s; %s", mdierr, mdimportOut)
	}

	return
}

func (u *Updater) removeApp(appPath string) error {
	// TODO: Move this Keybase specific logic outside of updater package since it
	// only applies to our app
	uninstaller := filepath.Join(appPath, "Contents", "Resources", "KeybaseInstaller.app", "Contents", "MacOS", "Keybase")
	if _, err := os.Stat(uninstaller); os.IsNotExist(err) {
		return fmt.Errorf("Remove app (privileged) is unavailable")
	}

	u.log.Debug("Using uninstaller: %s", uninstaller)
	uninstallOutput, err := exec.Command(uninstaller, "--uninstall-app", fmt.Sprintf("--app-path=%s", appPath), fmt.Sprintf("--run-mode=%s", u.config.GetRunModeAsString())).Output()
	u.log.Debug("Uninstaller: %s", uninstallOutput)
	return err
}
