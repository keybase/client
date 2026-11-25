// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"
	"path/filepath"
	"slices"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sys/unix"
)

// resolveMountDir returns mountDir as the kernel reports its mount: cleaned,
// with links in its parent resolved. The mount dir itself is not resolved,
// since that would ask the mounted file system, which may not answer.
func resolveMountDir(mountDir string) string {
	mountDir = filepath.Clean(mountDir)
	parent, err := filepath.EvalSymlinks(filepath.Dir(mountDir))
	if err != nil {
		return mountDir
	}
	return filepath.Join(parent, filepath.Base(mountDir))
}

// listMounts returns every mounted file system, without waiting on any of
// them to answer.
func listMounts() ([]unix.Statfs_t, error) {
	n, err := unix.Getfsstat(nil, unix.MNT_NOWAIT)
	if err != nil {
		return nil, err
	}
	// Room for mounts added since the count.
	buf := make([]unix.Statfs_t, n+16)
	n, err = unix.Getfsstat(buf, unix.MNT_NOWAIT)
	if err != nil {
		return nil, err
	}
	return buf[:n], nil
}

// mountInfosOwnedBy returns the mounts of the given fstypes that uid mounted.
func mountInfosOwnedBy(mounts []unix.Statfs_t, fstypes []string, uid uint32) []keybase1.FuseMountInfo {
	var infos []keybase1.FuseMountInfo
	for _, m := range mounts {
		fstype := unix.ByteSliceToString(m.Fstypename[:])
		if m.Owner != uid || !slices.Contains(fstypes, fstype) {
			continue
		}
		path := unix.ByteSliceToString(m.Mntonname[:])
		infos = append(infos, keybase1.FuseMountInfo{
			Fstype: fstype,
			Path:   path,
			Output: fmt.Sprintf("%s on %s (%s)", unix.ByteSliceToString(m.Mntfromname[:]), path, fstype),
		})
	}
	return infos
}
