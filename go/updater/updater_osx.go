// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package updater

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

func (u *Updater) checkPlatformSpecificUpdate(sourcePath string, destinationPath string) error {
	destFileInfo, err := os.Lstat(destinationPath)
	if err != nil {
		return err
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
	u.log.Info("Destination: %s, Uid: %d, Gid: %d", destinationPath, uid, gid)

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
	// TODO: On OSX call mdimport so Spotlight knows it changed?

	return u.applyZip(localPath)
}
