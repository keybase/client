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

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "github.com/src-d/go-billy"
)

// FS is a wrapper around a KBFS subdirectory that implements the
// billy.Filesystem interface.  It uses forward-slash separated paths.
// It may return errors wrapped with the `github.com/pkg/errors`
// package.
type FS struct {
	// Yes, storing ctx in a struct is a mortal sin, but the
	// billy.Filesystem interface doesn't give us a way to accept ctxs
	// any other way.
	ctx      context.Context
	config   libkbfs.Config
	root     libkbfs.Node
	log      logger.Logger
	deferLog logger.Logger
}

var _ billy.Filesystem = (*FS)(nil)

// NewFS returns a new FS instance, chroot'd to the given TLF and
// subdir within that TLF.  `subdir` must exist, and point to a
// directory, before this function is called.
func NewFS(ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, subdir string) (*FS, error) {
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}

	// Look up the subdir's root.
	n := rootNode
	var parts []string
	if len(subdir) > 0 {
		parts = strings.Split(subdir, "/")
	}
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

	log := config.MakeLogger("")
	log.CDebugf(ctx, "Made new FS for TLF=%s, subdir=%s",
		tlfHandle.GetCanonicalName(), subdir)

	return &FS{
		ctx:      ctx,
		config:   config,
		root:     n,
		log:      log,
		deferLog: log.CloneWithAddedDepth(1),
	}, nil
}

func (fs *FS) lookupOrCreateFile(
	dir libkbfs.Node, filename string, flag int, perm os.FileMode) (
	libkbfs.Node, libkbfs.EntryInfo, error) {
	n, ei, err := fs.config.KBFSOps().Lookup(fs.ctx, dir, filename)
	switch errors.Cause(err).(type) {
	case libkbfs.NoSuchNameError:
		// The file doesn't exist yet; create if requested
		if flag&os.O_CREATE == 0 {
			return nil, libkbfs.EntryInfo{}, err
		}
		fs.log.CDebugf(
			fs.ctx, "Creating %s since it doesn't exist yet", filename)
		excl := libkbfs.NoExcl
		if flag&os.O_EXCL != 0 {
			excl = libkbfs.WithExcl
		}
		isExec := (perm & 0100) != 0
		n, ei, err = fs.config.KBFSOps().CreateFile(
			fs.ctx, dir, filename, isExec, excl)
		switch errors.Cause(err).(type) {
		case libkbfs.NameExistsError:
			// Someone made it already; recurse to try the lookup again.
			fs.log.CDebugf(
				fs.ctx, "Attempting lookup again after failed create")
			return fs.lookupOrCreateFile(dir, filename, flag, perm)
		case nil:
			return n, ei, nil
		default:
			return nil, libkbfs.EntryInfo{}, err
		}
	case nil:
		// If we were supposed to have exclusively-created this file,
		// we must fail.
		if flag&os.O_CREATE != 0 && flag&os.O_EXCL != 0 {
			return nil, libkbfs.EntryInfo{},
				errors.New("Exclusive create failed because the file exists")
		}

		// Make sure this is a file.
		if !ei.Type.IsFile() {
			return nil, libkbfs.EntryInfo{},
				errors.Errorf("%s is not a file", filename)
		}
		return n, ei, nil
	default:
		return nil, libkbfs.EntryInfo{}, err
	}
}

// OpenFile implements the billy.Filesystem interface for FS.
func (fs *FS) OpenFile(filename string, flag int, perm os.FileMode) (
	f billy.File, err error) {
	fs.log.CDebugf(
		fs.ctx, "OpenFile %s, flag=%d, perm=%o", filename, flag, perm)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "OpenFile done: %+v", err)
	}()

	parts := strings.Split(filename, "/")
	n := fs.root
	for i := 0; i < len(parts)-1; i++ {
		p := parts[i]
		var ei libkbfs.EntryInfo
		n, ei, err = fs.config.KBFSOps().Lookup(fs.ctx, n, p)
		if err != nil {
			return nil, err
		}
		if ei.Type != libkbfs.Dir {
			return nil, errors.Errorf("%s is not a directory",
				path.Join(parts[:i]...))
		}
	}

	fName := parts[len(parts)-1]
	n, ei, err := fs.lookupOrCreateFile(n, fName, flag, perm)
	if err != nil {
		return nil, err
	}

	if flag&os.O_TRUNC != 0 {
		err := fs.config.KBFSOps().Truncate(fs.ctx, n, 0)
		if err != nil {
			return nil, err
		}
	}

	offset := int64(0)
	if flag&os.O_APPEND != 0 {
		// TODO: worry about overflow.
		offset = int64(ei.Size)
	}

	return &File{
		fs:       fs,
		filename: filename,
		node:     n,
		readOnly: flag == os.O_RDONLY,
		offset:   offset,
	}, nil
}

// Create implements the billy.Filesystem interface for FS.
func (fs *FS) Create(filename string) (billy.File, error) {
	return fs.OpenFile(filename, os.O_CREATE, 0600)
}

// Open implements the billy.Filesystem interface for FS.
func (fs *FS) Open(filename string) (billy.File, error) {
	return fs.OpenFile(filename, os.O_RDONLY, 0600)
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
	return path.Join(elem...)
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

func (fs *FS) SyncAll() error {
	return fs.config.KBFSOps().SyncAll(fs.ctx, fs.root.GetFolderBranch())
}
