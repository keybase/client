// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

// RootFS is a browseable (read-only) version of `/keybase`.  It
// does not support traversal into any subdirectories.
type RootFS struct {
	config libkbfs.Config
	log    logger.Logger
}

// NewRootFS creates a new RootFS instance.
func NewRootFS(config libkbfs.Config) *RootFS {
	return &RootFS{
		config: config,
		log:    config.MakeLogger(""),
	}
}

var _ billy.Filesystem = (*RootFS)(nil)

///// Read-only functions:

var rootWrappedNodeNames = map[string]bool{
	StatusFileName: true,
}

// Open implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Open(filename string) (f billy.File, err error) {
	if !rootWrappedNodeNames[filename] {
		// In particular, this FS doesn't let you open the folderlist
		// directories or anything in them.
		return nil, os.ErrNotExist
	}

	switch filename {
	case StatusFileName:
		return &wrappedReadFile{
			name: StatusFileName,
			reader: func(ctx context.Context) ([]byte, time.Time, error) {
				return GetEncodedStatus(ctx, rfs.config)
			},
			log: rfs.log,
		}, nil
	default:
		panic(fmt.Sprintf("Name %s was in map, but not in switch", filename))
	}
}

// OpenFile implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) OpenFile(filename string, flag int, _ os.FileMode) (
	f billy.File, err error) {
	if flag&os.O_CREATE != 0 {
		return nil, errors.New("RootFS can't create files")
	}

	return rfs.Open(filename)
}

// Lstat implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Lstat(filename string) (fi os.FileInfo, err error) {
	if filename == "" {
		filename = "."
	}
	if filename == "." {
		return &wrappedReadFileInfo{
			"keybase", 0, rfs.config.Clock().Now(), true}, nil
	}
	if !rootWrappedNodeNames[filename] {
		return nil, os.ErrNotExist
	}

	switch filename {
	case StatusFileName:
		wrf := &wrappedReadFile{
			name: StatusFileName,
			reader: func(ctx context.Context) ([]byte, time.Time, error) {
				return GetEncodedStatus(ctx, rfs.config)
			},
			log: rfs.log,
		}
		return wrf.GetInfo(), nil
	default:
		panic(fmt.Sprintf("Name %s was in map, but not in switch", filename))
	}
}

// Stat implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Stat(filename string) (fi os.FileInfo, err error) {
	return rfs.Lstat(filename)
}

// Join implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Join(elem ...string) string {
	return path.Clean(path.Join(elem...))
}

// ReadDir implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) ReadDir(p string) (fis []os.FileInfo, err error) {
	if p == "" {
		p = "."
	}

	if p != "." {
		return nil, os.ErrNotExist
	}

	now := rfs.config.Clock().Now()
	return []os.FileInfo{
		&wrappedReadFileInfo{"private", 0, now, true},
		&wrappedReadFileInfo{"public", 0, now, true},
		&wrappedReadFileInfo{"team", 0, now, true},
	}, nil
}

// Readlink implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Readlink(_ string) (target string, err error) {
	return "", errors.New("RootFS cannot read links")
}

// Chroot implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Chroot(_ string) (newFS billy.Filesystem, err error) {
	// Don't allow chroot'ing anywhere outside of the root FS since we
	// haven't yet implemented folderlist browsing.
	return nil, errors.New("RootFS cannot chroot")
}

// Root implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Root() string {
	return "/keybase"
}

///// Modifying functions (not supported):

// Create implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Create(_ string) (billy.File, error) {
	return nil, errors.New("RootFS cannot create files")
}

// Rename implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Rename(_, _ string) (err error) {
	return errors.New("RootFS cannot rename files")
}

// Remove implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Remove(_ string) (err error) {
	return errors.New("RootFS cannot remove files")
}

// TempFile implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) TempFile(_, _ string) (billy.File, error) {
	return nil, errors.New("RootFS cannot make temp files")
}

// MkdirAll implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) MkdirAll(_ string, _ os.FileMode) (err error) {
	return errors.New("RootFS cannot mkdir")
}

// Symlink implements the billy.Filesystem interface for RootFS.
func (rfs *RootFS) Symlink(_, _ string) (err error) {
	return errors.New("RootFS cannot make symlinks")
}

// ToHTTPFileSystem calls fs.WithCtx with ctx to create a *RootFS with the new
// ctx, and returns a wrapper around it that satisfies the http.FileSystem
// interface. ctx is ignored here.
func (rfs *RootFS) ToHTTPFileSystem(ctx context.Context) http.FileSystem {
	return httpRootFileSystem{rfs: &RootFS{
		config: rfs.config,
		log:    rfs.log,
	}}
}
