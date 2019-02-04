// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package install

import (
	"os"

	"github.com/keybase/client/go/lsof"
)

// IsInUse returns true if the mount is in use. This may be used by the updater
// to determine if it's safe to apply an update and restart.
func IsInUse(mountDir string, log Log) bool {
	// ignore error
	lsofResults, _ := LsofMount(mountDir, log)
	return len(lsofResults) > 0
}

// LsofMount does not return an error if it was unable to lsof
// the mountpoint or the mountpoint does not exist.
func LsofMount(mountDir string, log Log) ([]CommonLsofResult, error) {
	log.Debug("Mount dir to lsof: %s", mountDir)
	if mountDir == "" {
		return nil, nil
	}
	if _, serr := os.Stat(mountDir); os.IsNotExist(serr) {
		log.Debug("%s, mount dir lsof target, doesn't exist", mountDir)
		return nil, nil
	}

	log.Debug("Checking mount (lsof)")
	processes, err := lsof.MountPoint(mountDir)
	if err != nil {
		// If there is an error in lsof it's ok to continue
		// An exit status of 1 means that the mount is not in use, and is
		// not really an error.
		log.Debug("Continuing despite error in lsof: %s", err)
		return nil, nil
	}
	var ret []CommonLsofResult
	for _, process := range processes {
		ret = append(ret, CommonLsofResult{process.PID, process.Command})
	}
	return ret, nil
}
