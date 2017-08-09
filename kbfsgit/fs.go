// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"os"
	"time"

	_ "github.com/keybase/kbfs/libkbfs"
	billy "github.com/src-d/go-billy"
)

// FS is a wrapper around a KBFS subdirectory that implements the
// billy.Filesystem interface.
type FS struct {
}

var _ billy.Filesystem = (*FS)(nil)

// Create implements the billy.Filesystem interface for FS.
func (fs *FS) Create(filename string) (billy.File, error) {
	return nil, nil
}

// Open implements the billy.Filesystem interface for FS.
func (fs *FS) Open(filename string) (billy.File, error) {
	return nil, nil
}

// OpenFile implements the billy.Filesystem interface for FS.
func (fs *FS) OpenFile(filename string, flag int, perm os.FileMode) (
	billy.File, error) {
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
