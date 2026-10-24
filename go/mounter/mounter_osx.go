// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package mounter

import (
	"os"
	"regexp"
	"slices"
	"syscall"
)

// KBFSFstypes are the filesystem types a KBFS mount can have. kbfuse is the
// legacy Keybase-bundled FUSE, so leftover mounts can still be found and
// unmounted. Remove it once the legacy helper retirement has removed kbfuse
// from upgraders' machines.
var KBFSFstypes = []string{"macfuse", "kbfuse"}

// IsMounted returns true if directory is a KBFS FUSE mount the current user
// owns.
func IsMounted(dir string, log Log) (bool, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(dir, &st); err != nil {
		return false, err
	}
	log.Debug("Mount info: fstype=%s from=%s owner=%d", cstr(st.Fstypename[:]),
		unescapeBackslash(cstr(st.Mntfromname[:])), st.Owner)
	return isOwnKBFSMount(st, uint32(os.Getuid())), nil
}

func isOwnKBFSMount(st syscall.Statfs_t, uid uint32) bool {
	return st.Owner == uid && slices.Contains(KBFSFstypes, cstr(st.Fstypename[:]))
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
