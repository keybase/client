// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package updater

func (u *Updater) applyUpdate(localPath string) (tmpPath string, err error) {
	// TODO: On OSX call mdimport so Spotlight knows it changed?

	return u.applyZip(localPath)
}
