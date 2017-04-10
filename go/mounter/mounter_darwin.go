// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package mounter

import (
	"regexp"
	"strings"
	"syscall"
)

// IsMounted returns true if directory is mounted (by kbfuse)
func IsMounted(dir string, log Log) (bool, error) {
	mountInfo, err := getMountInfo(dir)
	if err != nil {
		return false, err
	}

	log.Debug("Mount info: %s", mountInfo)
	if strings.Contains(mountInfo, "@kbfuse") {
		return true, nil
	}

	return false, nil
}

//
// Below is from bazil/fuse fstestutil
//

var reBackslash = regexp.MustCompile(`\\(.)`)

// unescapeBackslash removes backslash-escaping. The escaped characters are not
// mapped in any way; that is, unescape(`\n` ) == `n`.
func unescapeBackslash(s string) string {
	return reBackslash.ReplaceAllString(s, `$1`)
}

// cstr converts a nil-terminated C string into a Go string
func cstr(ca []int8) string {
	s := make([]byte, 0, len(ca))
	for _, c := range ca {
		if c == 0x00 {
			break
		}
		s = append(s, byte(c))
	}
	return string(s)
}

func getMountInfo(mnt string) (string, error) {
	var st syscall.Statfs_t
	err := syscall.Statfs(mnt, &st)
	if err != nil {
		return "", err
	}
	return unescapeBackslash(cstr(st.Mntfromname[:])), nil
}
