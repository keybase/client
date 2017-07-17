// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package spotty

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"syscall"
)

func sameFile(ss1 *syscall.Stat_t, fi os.FileInfo) bool {
	if ss2, ok := fi.Sys().(*syscall.Stat_t); ok {
		return ss1.Dev == ss2.Dev && ss1.Rdev == ss2.Rdev && ss1.Ino == ss2.Ino
	}
	return false
}

// Discover which named TTY we have open as FD=0. Will return empty string if nothing
// was found, and an non-nil error if there was a problem. Will noop on Windows.
func Discover() (string, error) {
	var sstat syscall.Stat_t
	if err := syscall.Fstat(0, &sstat); err != nil {
		return "", err
	}
	res, err := findFileIn(&sstat, "/dev", regexp.MustCompile(`^tty[A-Za-z0-9]+$`))
	if err != nil {
		return "", err
	}
	if len(res) > 0 {
		return res, nil
	}
	res, err = findFileIn(&sstat, "/dev/pts", regexp.MustCompile(`^[0-9]+$`))
	return res, err
}

func findFileIn(ss *syscall.Stat_t, dir string, re *regexp.Regexp) (string, error) {
	v, err := ioutil.ReadDir(dir)
	if err != nil {
		if _, ok := err.(*os.PathError); ok {
			return "", nil
		}
		return "", err
	}
	for _, fi := range v {
		if !re.MatchString(fi.Name()) {
			continue
		}
		if sameFile(ss, fi) {
			return filepath.Join(dir, fi.Name()), nil
		}
	}
	return "", nil
}
