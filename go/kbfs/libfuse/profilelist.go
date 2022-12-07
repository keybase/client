// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build !windows
// +build !windows

package libfuse

import (
	"io"
	"os"
	"strings"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"

	"golang.org/x/net/context"
)

// timedProfileFile represents a file whose contents are determined by
// taking a profile for some duration.
type timedProfileFile struct {
	pfs  libfs.ProfileFS
	name string
}

var _ fs.Node = timedProfileFile{}

func (tpf timedProfileFile) Attr(ctx context.Context, a *fuse.Attr) error {
	// Have a low non-zero value for Valid to avoid being swamped
	// with requests.
	a.Valid = 1 * time.Second
	now := time.Now()
	a.Size = 0
	a.Mtime = now
	a.Ctime = now
	a.Mode = 0444
	return nil
}

var _ fs.NodeOpener = timedProfileFile{}

func (tpf timedProfileFile) Open(ctx context.Context,
	req *fuse.OpenRequest, resp *fuse.OpenResponse) (fs.Handle, error) {
	f, err := tpf.pfs.OpenWithContext(ctx, tpf.name)
	if err != nil {
		return nil, err
	}

	buf, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	resp.Flags |= fuse.OpenDirectIO
	return fs.DataHandle(buf), nil
}

// ProfileList is a node that can list all of the available profiles.
type ProfileList struct {
	config libkbfs.Config
}

var _ fs.Node = ProfileList{}

// Attr implements the fs.Node interface.
func (ProfileList) Attr(_ context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = ProfileList{}

// Lookup implements the fs.NodeRequestLookuper interface.
func (pl ProfileList) Lookup(_ context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	pfs := libfs.NewProfileFS(pl.config)

	// Handle timed profiles first.
	if strings.HasPrefix(req.Name, libfs.CPUProfilePrefix) ||
		strings.HasPrefix(req.Name, libfs.TraceProfilePrefix) {
		return timedProfileFile{pfs, req.Name}, nil
	}

	f := libfs.ProfileGet(req.Name)
	if f == nil {
		return nil, fuse.ENOENT
	}
	resp.EntryValid = 0
	return &SpecialReadFile{read: f}, nil
}

var _ fs.Handle = ProfileList{}

var _ fs.HandleReadDirAller = ProfileList{}

// ReadDirAll implements the ReadDirAll interface.
func (pl ProfileList) ReadDirAll(_ context.Context) (res []fuse.Dirent, err error) {
	profiles := libfs.ListProfileNames()
	res = make([]fuse.Dirent, 0, len(profiles))
	for _, p := range profiles {
		res = append(res, fuse.Dirent{
			Type: fuse.DT_File,
			Name: p,
		})
	}
	return res, nil
}

var _ fs.NodeRemover = (*FolderList)(nil)

// Remove implements the fs.NodeRemover interface for ProfileList.
func (ProfileList) Remove(_ context.Context, req *fuse.RemoveRequest) (err error) {
	return fuse.EPERM
}
