// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
)

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

func (r root) Lookup(
	ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (
	n fs.Node, err error) {
	u, err := user.LookupId(strconv.FormatUint(uint64(req.Header.Uid), 10))
	if err != nil {
		return nil, err
	}
	// TODO: A real implementation should parse the
	// keybase/config.json of the user to find if the user set a
	// different mountdir.  But what to do if the user has
	// $XDG_DATA_DIR or $KEYBASE_MOUNTDIR set?  Should we parse the
	// `mount` output, or try to run `keybase status` on behalf of the
	// user?
	var mountpoint string
	switch runtime.GOOS {
	case "linux":
		mountpoint = fmt.Sprintf("%s/.local/share/keybase/fs", u.HomeDir)
	case "darwin":
		mountpoint = fmt.Sprintf("%s/keybase", u.HomeDir)
	case "windows":
		panic("Unsupported")
	default:
		mountpoint = fmt.Sprintf("%s/.local/share/keybase/fs", u.HomeDir)
	}
	fmt.Printf("Lookup %s %s\n", req.Name, mountpoint)
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
	c, err := fuse.Mount(os.Args[1], fuse.AllowOther())
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
