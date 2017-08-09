// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"context"
	"os"
	"path"
	"strings"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "github.com/src-d/go-billy"
)

// FS is a wrapper around a KBFS subdirectory that implements the
// billy.Filesystem interface.  It uses forward-slash separated paths.
type FS struct {
	ctx    context.Context
	config libkbfs.Config
	root   libkbfs.Node
}

var _ billy.Filesystem = (*FS)(nil)

// NewFS returns a new FS instance, chroot'd to the given TLF and
// subdir within that TLF.  `subdir` must exist, and point to a
// directory, before this function is called.
func NewFS(ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, subdir string) (*FS, error) {
	rootNode, _, err := config.KBFSOps().GetRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}

	// Look up the subdir's root.
	n := rootNode
	parts := strings.Split(subdir, "/")
	for i, p := range parts {
		var ei libkbfs.EntryInfo
		n, ei, err = config.KBFSOps().Lookup(ctx, n, p)
		if err != nil {
			return nil, err
		}
		if ei.Type != libkbfs.Dir {
			return nil, errors.Errorf("%s is not a directory",
				path.Join(parts[:i]...))
		}
	}

	return &FS{
		ctx:    ctx,
		config: config,
		root:   n,
	}, nil
}

// OpenFile implements the billy.Filesystem interface for FS.
func (fs *FS) OpenFile(filename string, flag int, perm os.FileMode) (
	billy.File, error) {
	return nil, nil
}

// Create implements the billy.Filesystem interface for FS.
func (fs *FS) Create(filename string) (billy.File, error) {
	return nil, nil
}

// Open implements the billy.Filesystem interface for FS.
func (fs *FS) Open(filename string) (billy.File, error) {
	return nil, nil
}

// Stat implements the billy.Filesystem interface for FS.
func (fs *FS) Stat(filename string) (os.FileInfo, error) {
	return nil, nil
}

// Rename implements the billy.Filesystem interface for FS.
func (fs *FS) Rename(oldpath, newpath string) error {
	return nil
}

// Remove implements the billy.Filesystem interface for FS.
func (fs *FS) Remove(filename string) error {
	return nil
}

// Join implements the billy.Filesystem interface for FS.
func (fs *FS) Join(elem ...string) string {
	return ""
}

// TempFile implements the billy.Filesystem interface for FS.
func (fs *FS) TempFile(dir, prefix string) (billy.File, error) {
	return nil, nil
}

// ReadDir implements the billy.Filesystem interface for FS.
func (fs *FS) ReadDir(path string) ([]os.FileInfo, error) {
	return nil, nil
}

// MkdirAll implements the billy.Filesystem interface for FS.
func (fs *FS) MkdirAll(filename string, perm os.FileMode) error {
	return nil
}

// Lstat implements the billy.Filesystem interface for FS.
func (fs *FS) Lstat(filename string) (os.FileInfo, error) {
	return nil, nil
}

// Symlink implements the billy.Filesystem interface for FS.
func (fs *FS) Symlink(target, link string) error {
	return nil
}

// Readlink implements the billy.Filesystem interface for FS.
func (fs *FS) Readlink(link string) (string, error) {
	return "", nil
}

// Chmod implements the billy.Filesystem interface for FS.
func (fs *FS) Chmod(name string, mode os.FileMode) error {
	return nil
}

// Lchown implements the billy.Filesystem interface for FS.
func (fs *FS) Lchown(name string, uid, gid int) error {
	return nil
}

// Chown implements the billy.Filesystem interface for FS.
func (fs *FS) Chown(name string, uid, gid int) error {
	return nil
}

// Chtimes implements the billy.Filesystem interface for FS.
func (fs *FS) Chtimes(name string, atime time.Time, mtime time.Time) error {
	return nil
}

// Chroot implements the billy.Filesystem interface for FS.
func (fs *FS) Chroot(path string) (billy.Filesystem, error) {
	return nil, nil
}

// Root implements the billy.Filesystem interface for FS.
func (fs *FS) Root() string {
	return ""
}
