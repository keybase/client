// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/strib/gomounts"
)

var kbfusePath = fuse.OSXFUSEPaths{
	DevicePrefix: "/dev/kbfuse",
	Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
	Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
	DaemonVar:    "MOUNT_KBFUSE_DAEMON_PATH",
}

type symlink struct {
	link string
}

func (s symlink) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	a.Mode = os.ModeSymlink | a.Mode | 0555
	a.Valid = 0
	return nil
}

func (s symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (
	link string, err error) {
	return s.link, nil
}

type root struct {
}

func (r root) Root() (fs.Node, error) {
	return r, nil
}

func (r root) Attr(ctx context.Context, attr *fuse.Attr) error {
	attr.Mode = os.ModeDir | 0555
	return nil
}

func (r root) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	return []fuse.Dirent{
		{
			Type: fuse.DT_Link,
			Name: "private",
		},
		{
			Type: fuse.DT_Link,
			Name: "public",
		},
		fuse.Dirent{
			Type: fuse.DT_Link,
			Name: "team",
		},
	}, nil
}

func findKBFSMount(uid string) (string, error) {
	vols, err := gomounts.GetMountedVolumes()
	if err != nil {
		return "", err
	}
	fuseType := "fuse"
	if runtime.GOOS == "darwin" {
		fuseType = "kbfuse"
	}
	var fuseMountPoints []string
	for _, v := range vols {
		if v.Type != fuseType {
			continue
		}
		if v.Owner != uid {
			continue
		}
		fuseMountPoints = append(fuseMountPoints, v.Path)
	}

	if len(fuseMountPoints) == 0 {
		return "", fuse.ENOENT
	}
	if len(fuseMountPoints) == 1 {
		return fuseMountPoints[0], nil
	}

	// If there is more than one, pick the first one alphabetically
	// that has "keybase" in the path.
	sort.Strings(fuseMountPoints)
	for _, mp := range fuseMountPoints {
		// TODO: a better regexp that will rule out keybase.staging if
		// we're in prod mode, etc.
		if strings.Contains(mp, "keybase") {
			return mp, nil
		}
	}

	// Give up and return the first one.
	return fuseMountPoints[0], nil
}

func (r root) Lookup(
	ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (
	n fs.Node, err error) {
	u, err := user.LookupId(strconv.FormatUint(uint64(req.Header.Uid), 10))
	if err != nil {
		return nil, err
	}
	mountpoint, err := findKBFSMount(u.Uid)
	if err != nil {
		return nil, err
	}

	resp.EntryValid = 0
	switch req.Name {
	case "private":
		return symlink{filepath.Join(mountpoint, "private")}, nil
	case "public":
		return symlink{filepath.Join(mountpoint, "public")}, nil
	case "team":
		return symlink{filepath.Join(mountpoint, "team")}, nil
	}
	return nil, fuse.ENOENT
}

func main() {
	// This must be run as soon (or edit /etc/fuse.conf to enable
	// `user_allow_other`).
	options := []fuse.MountOption{fuse.AllowOther()}
	options = append(options, fuse.FSName("keybase-redirector"))
	if runtime.GOOS == "darwin" {
		options = append(options, fuse.OSXFUSELocations(kbfusePath))
		options = append(options, fuse.VolumeName("keybase-redirector"))
		options = append(options, fuse.NoBrowse())
	}

	c, err := fuse.Mount(os.Args[1], options...)
	if err != nil {
		panic(err)
	}

	srv := fs.New(c, &fs.Config{
		WithContext: func(ctx context.Context, _ fuse.Request) context.Context {
			return context.Background()
		},
	})
	srv.Serve(root{})
}
