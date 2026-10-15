// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"os"
	"path/filepath"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/unix"
)

func statfs(from, on, fstype string, owner uint32) unix.Statfs_t {
	var m unix.Statfs_t
	copy(m.Mntfromname[:], from)
	copy(m.Mntonname[:], on)
	copy(m.Fstypename[:], fstype)
	m.Owner = owner
	return m
}

func TestMountInfosOwnedBy(t *testing.T) {
	mounts := []unix.Statfs_t{
		statfs("/dev/disk3s1s1", "/", "apfs", 0),
		statfs("kbfs@macfuse0", "/Volumes/Keybase (testuser)", "macfuse", 501),
		statfs("kbfs@macfuse1", "/Volumes/Keybase (testuser-mac)", "macfuse", 502),
		statfs("kbfs@kbfuse0", "/Volumes/Keybase", "kbfuse", 0),
		statfs("kbfs@kbfuse1", "/Volumes/Keybase (old)", "kbfuse", 501),
	}
	require.Equal(t, []keybase1.FuseMountInfo{
		{Fstype: "macfuse", Path: "/Volumes/Keybase (testuser)", Output: "kbfs@macfuse0 on /Volumes/Keybase (testuser) (macfuse)"},
		{Fstype: "kbfuse", Path: "/Volumes/Keybase (old)", Output: "kbfs@kbfuse1 on /Volumes/Keybase (old) (kbfuse)"},
	}, mountInfosOwnedBy(mounts, []string{"macfuse", "kbfuse"}, 501))
	require.Empty(t, mountInfosOwnedBy(mounts, []string{"macfuse"}, 503))
	require.Empty(t, mountInfosOwnedBy(nil, []string{"macfuse"}, 501))
}

func TestListMounts(t *testing.T) {
	mounts, err := listMounts()
	require.NoError(t, err)
	var paths []string
	for _, m := range mounts {
		paths = append(paths, unix.ByteSliceToString(m.Mntonname[:]))
	}
	require.Contains(t, paths, "/")
}

func TestResolveMountDir(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	link := filepath.Join(tmp, "link")
	require.NoError(t, os.Symlink(tmp, link))
	require.Equal(t, filepath.Join(tmp, "Keybase (testuser)"), resolveMountDir(link+"/Keybase (testuser)/"))
	require.Equal(t, "/nowhere/Keybase", resolveMountDir("/nowhere/Keybase/"))
}
