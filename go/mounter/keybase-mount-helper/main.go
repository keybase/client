// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

// keybase-mount-helper is a simple program intended to be run with
// SUID permissions as a keybase helper user, which manages the
// /var/lib/keybase/mount1 symlink, pointing to a user's KBFS
// mountpoint.  The first user to run this program captures the
// symlink; others will get an error.

package main

import (
	"flag"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"syscall"
)

const (
	kbUsername = "keybasehelper"
)

var (
	fFirstMountLink           string
	fOriginalFirstMountTarget string
	fUserMount                string
)

func runModeToKeybase() string {
	switch os.Getenv("KEYBASE_RUN_MODE") {
	case "prod":
		return "keybase"
	case "staging":
		return "keybase.staging"
	case "devel":
		return "keybase.devel"
	default:
		// Prod by default.
		return "keybase"
	}
}

func getDefaultUserMount() string {
	// Do basically the same thing as libkb.Env.GetMountDir(), but
	// let's not include that library because it blows up the size of
	// the keybase-mount-helper binary by 10x.
	mountDir := os.Getenv("KEYBASE_MOUNTDIR")
	if len(mountDir) > 0 {
		return mountDir
	}

	home := os.Getenv("HOME")
	mountDir = runModeToKeybase()

	switch runtime.GOOS {
	case "windows":
		panic("Not supported on Windows")
	case "darwin":
		return filepath.Join(
			home, "Library", "Application Support", mountDir, "fs")
	default:
		xdgDataDir := os.Getenv("XDG_DATA_HOME")
		if len(xdgDataDir) > 0 {
			return filepath.Join(xdgDataDir, mountDir, "fs")
		}
		return filepath.Join(home, ".local", "share", mountDir, "fs")
	}
}

func init() {
	flag.StringVar(&fFirstMountLink, "first-mount-link",
		"/var/lib/keybase/mount1",
		"path to an existing symlink that should be switched to be a link to "+
			"the given user mount directory, if it's not already claimed "+
			"by another user")
	flag.StringVar(&fOriginalFirstMountTarget, "original-first-mount-target",
		"/opt/keybase/mount-readme",
		"the target of the first mount symlink when Keybase was installed")
	// Get the calling user's UID before doing a SYS_SETUID.
	flag.StringVar(&fUserMount, "user-mount", getDefaultUserMount(),
		"path to an existing directory that will serve as the true mountpoint "+
			"for the Keybase user")
}

func checkLink(firstMountLink, originalFirstMountTarget, userMount string) (
	firstMount bool, makeMount bool, err error) {
	currLink, err := os.Readlink(firstMountLink)
	if err != nil {
		return false, false, err
	}

	if currLink == userMount {
		// User already owns the link.
		return true, false, nil
	}

	if currLink != originalFirstMountTarget {
		// Another user already owns this link.
		return false, false, nil
	}

	// User may try to make the link.
	return true, true, nil
}

func takeLock(firstMountLink string) (lockFile *os.File, err error) {
	// Take an flock to ensure only one user tries to get the link.
	lockFilename := firstMountLink + ".lock"
	lockFile, err = os.Create(lockFilename)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			lockErr := lockFile.Close()
			if lockErr != nil {
				fmt.Fprintf(os.Stderr, "Couldn't close lock file: %+v", lockErr)
			}
		}
	}()

	err = syscall.Flock(int(lockFile.Fd()), syscall.LOCK_EX)
	if err != nil {
		return nil, err
	}
	return lockFile, nil
}

func checkAndSwitchMount(
	firstMountLink, originalFirstMountTarget, userMount string) (
	firstMount bool, err error) {
	firstMount, makeMount, err := checkLink(
		firstMountLink, originalFirstMountTarget, userMount)
	if err != nil {
		return false, err
	}
	if !makeMount {
		return firstMount, nil
	}

	lockFile, err := takeLock(firstMountLink)
	if err != nil {
		return false, err
	}

	defer func() {
		lockErr := lockFile.Close()
		if err == nil {
			err = lockErr
		}
	}()

	// Make sure the link is in the same state after taking the lock.
	firstMount, makeMount, err = checkLink(
		firstMountLink, originalFirstMountTarget, userMount)
	if err != nil {
		return false, err
	}
	if !makeMount {
		return firstMount, nil
	}

	// Make a symlink for the new user, and swap it over the existing
	// symlink.
	tmpLink := firstMountLink + ".tmp"
	err = os.Symlink(userMount, tmpLink)
	if err != nil {
		return false, err
	}

	defer func() {
		if err != nil {
			rmErr := os.Remove(tmpLink)
			if rmErr != nil {
				fmt.Fprintf(os.Stderr,
					"Can't remove %s on error: %+v\n", tmpLink, rmErr)
			}
		}
	}()

	err = os.Rename(tmpLink, firstMountLink)
	if err != nil {
		return false, err
	}
	return true, nil
}

func main() {
	flag.Parse()

	// Figure out the helper UID.
	khUser, err := user.Lookup(kbUsername)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Cannot get %s user: %+v\n", kbUsername, err)
		os.Exit(1)
	}
	khUID, err := strconv.Atoi(khUser.Uid)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Bad UID for %s user: %+v\n", kbUsername, err)
		os.Exit(1)
	}

	// Lock the thread (because SYS_SETUID only sets the UID of the
	// current OS thread) and switch to the helper user.
	runtime.LockOSThread()
	_, _, errNo := syscall.Syscall(syscall.SYS_SETUID, uintptr(khUID), 0, 0)
	if errNo != 0 {
		fmt.Fprintf(os.Stderr, "Can't setuid: %+v\n", errNo)
		os.Exit(1)
	}

	// Check the mount and switch it to the calling user's mountpoint
	// if possible.
	firstMount, err := checkAndSwitchMount(
		fFirstMountLink, fOriginalFirstMountTarget, fUserMount)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Can't switch mountpoint: %+v\n", err)
		os.Exit(1)
	}

	if !firstMount {
		home := os.Getenv("HOME")
		suggestedLink := filepath.Join(home, runModeToKeybase())
		target, err := os.Readlink(suggestedLink)
		if err != nil || target != fUserMount {
			fmt.Printf("Your mountpoint is %s; consider `ln -s %s %s`\n",
				fUserMount, fUserMount, suggestedLink)
		}
	}
}
