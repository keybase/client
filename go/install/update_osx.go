// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package install

// AfterUpdateApply runs after an update has been applied
func AfterUpdateApply(context Context, willRestart bool, force bool, log Log) error {
	if !willRestart {
		return nil
	}
	reinstallKBFS, err := checkFuseUpgrade(context, "/Applications/Keybase.app", force, log)
	if err != nil {
		log.Errorf("Error trying to upgrade Fuse: %s", err)
	}
	if reinstallKBFS {
		log.Info("Re-installing KBFS")
		err := InstallKBFS(context, "", false, defaultLaunchdWait, log)
		if err != nil {
			log.Errorf("Error re-installing KBFS (after Fuse upgrade): %s", err)
		}
	}
	return nil
}
