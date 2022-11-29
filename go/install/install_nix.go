// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !windows
// +build !windows

package install

import (
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/keybase/client/go/lsof"
)

// maybeKernelOpenFiles returns true if the kernel might currently
// have open files.  If it returns false, the mount is definitely not
// in use.
func maybeKernelOpenFiles(mountDir string, log Log) bool {
	// This file name is copied from kbfs/libfs/constants.go because
	// importing that package bloats the `keybase` service binary and
	// causes compilation issues.
	p := filepath.Join(mountDir, ".kbfs_open_file_count")
	f, err := os.Open(p)
	if err != nil {
		log.Debug("Couldn't check for open files in %s: %+v", p, err)
		return true
	}
	defer f.Close()

	b, err := io.ReadAll(f)
	if err != nil {
		log.Debug("Couldn't read the open file count in %s: %+v", p, err)
		return true
	}

	numOpenFiles, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil {
		log.Debug("Couldn't parse the open file count (%s) in %s: %+v",
			string(b), p, err)
		return true
	}

	return numOpenFiles != 0
}

// IsInUse returns true if the mount is in use. This may be used by the updater
// to determine if it's safe to apply an update and restart.
func IsInUse(mountDir string, log Log) bool {
	// Shortcut to avoid expensive lsof call if KBFS tells us that
	// there are definitely no open files.
	if !maybeKernelOpenFiles(mountDir, log) {
		log.Debug("Definitely no open files; skipping lsof")
		return false
	}

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
