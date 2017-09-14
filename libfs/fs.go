// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"os"
	"path"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v3"
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
	rootInfo libkbfs.EntryInfo
	h        *libkbfs.TlfHandle
	subdir   string
	uniqID   string
	log      logger.Logger
	deferLog logger.Logger
}

var _ billy.Filesystem = (*FS)(nil)

const (
	maxSymlinkLevels = 40 // same as Linux
)

// NewFS returns a new FS instance, chroot'd to the given TLF and
// subdir within that TLF.  `subdir` must exist, and point to a
// directory, before this function is called.  `uniqID` needs to
// uniquely identify this instance among all users of this TLF
// globally; for example, a device ID combined with a local tempfile
// name is recommended.
func NewFS(ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, subdir string, uniqID string) (*FS, error) {
	rootNode, ei, err := config.KBFSOps().GetOrCreateRootNode(
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
		rootInfo: ei,
		h:        tlfHandle,
		subdir:   subdir,
		uniqID:   uniqID,
		log:      log,
		deferLog: log.CloneWithAddedDepth(1),
	}, nil
}

// lookupOrCreateEntryNoFollow looks up the entry for a file in a
// given parent node.  If the entry is a symlink, it will return a nil
// Node and a nil error.  If the entry doesn't exist and O_CREATE is
// set in `flag`, it will create the entry as a file.
func (fs *FS) lookupOrCreateEntryNoFollow(
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
			return fs.lookupOrCreateEntryNoFollow(dir, filename, flag, perm)
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

		if ei.Type == libkbfs.Sym {
			// The caller must retry if desired.
			return nil, ei, nil
		}

		return n, ei, nil
	default:
		return nil, libkbfs.EntryInfo{}, err
	}
}

func followSymlink(parentPath, link string) (newPath string, err error) {
	if path.IsAbs(link) {
		return "", errors.Errorf("Can't follow absolute link: %s", link)
	}

	newPath = path.Clean(path.Join(parentPath, link))
	if strings.HasPrefix(newPath, "..") {
		return "", errors.Errorf(
			"Cannot follow symlink out of chroot: %s", newPath)
	}

	return newPath, nil
}

// lookupParentWithDepth looks up the parent node of the given
// filename.  It follows symlinks in the path, but doesn't resolve the
// final base name.  If `exitEarly` is true, it returns on the first
// not-found error and `base` will contain the subpath of filename not
// yet found.
func (fs *FS) lookupParentWithDepth(
	filename string, exitEarly bool, depth int) (
	parent libkbfs.Node, parentDir, base string, err error) {
	parts := strings.Split(filename, "/")
	n := fs.root
	// Iterate through each of the parent directories of the file, but
	// not the file itself.
	for i := 0; i < len(parts)-1; i++ {
		p := parts[i]
		nextNode, ei, err := fs.config.KBFSOps().Lookup(fs.ctx, n, p)
		switch errors.Cause(err).(type) {
		case libkbfs.NoSuchNameError:
			if exitEarly {
				parentDir = path.Join(parts[:i]...)
				base = path.Join(parts[i:]...)
				return n, parentDir, base, nil
			}
			return nil, "", "", err
		case nil:
			n = nextNode
		default:
			return nil, "", "", err
		}

		switch ei.Type {
		case libkbfs.Sym:
			if depth == maxSymlinkLevels {
				return nil, "", "", errors.New("Too many levels of symlinks")
			}
			parentDir = path.Join(parts[:i]...)
			newPath, err := followSymlink(parentDir, ei.SymPath)
			if err != nil {
				return nil, "", "", err
			}
			newPathPlusRemainder := append([]string{newPath}, parts[i+1:]...)
			return fs.lookupParentWithDepth(
				path.Join(newPathPlusRemainder...), exitEarly, depth+1)
		case libkbfs.Dir:
			continue
		default:
			return nil, "", "", errors.Errorf("%s is not a directory",
				path.Join(parts[:i]...))
		}
	}

	parentDir = path.Join(parts[:len(parts)-1]...)
	base = parts[len(parts)-1]
	return n, parentDir, base, nil
}

func (fs *FS) lookupParent(filename string) (
	parent libkbfs.Node, parentDir, base string, err error) {
	return fs.lookupParentWithDepth(filename, false, 0)
}

// lookupOrCreateEntry looks up the entry for a filename, following
// symlinks in the path (including if the final entry is a symlink).
// If the entry doesn't exist an O_CREATE is set in `flag`, it will
// create the entry as a file.
func (fs *FS) lookupOrCreateEntry(
	filename string, flag int, perm os.FileMode) (
	n libkbfs.Node, ei libkbfs.EntryInfo, err error) {
	// Shortcut the case where there's nothing to look up.
	if filename == "" || filename == "/" {
		return fs.root, fs.rootInfo, nil
	}

	for i := 0; i < maxSymlinkLevels; i++ {
		var parentDir, fName string
		n, parentDir, fName, err = fs.lookupParent(filename)
		if err != nil {
			return nil, libkbfs.EntryInfo{}, err
		}

		n, ei, err := fs.lookupOrCreateEntryNoFollow(n, fName, flag, perm)
		if err != nil {
			return nil, libkbfs.EntryInfo{}, err
		}

		if ei.Type != libkbfs.Sym {
			return n, ei, nil
		}
		fs.log.CDebugf(fs.ctx, "Following symlink=%s from dir=%s",
			ei.SymPath, parentDir)
		filename, err = followSymlink(parentDir, ei.SymPath)
		if err != nil {
			return nil, libkbfs.EntryInfo{}, err
		}
	}
	return nil, libkbfs.EntryInfo{}, errors.New("Too many levels of symlinks")
}

func translateErr(err error) error {
	switch errors.Cause(err).(type) {
	case libkbfs.NoSuchNameError:
		return os.ErrNotExist
	case libkbfs.NameExistsError:
		return os.ErrExist
	default:
		return err
	}
}

func (fs *FS) mkdirAll(filename string, perm os.FileMode) (err error) {
	defer func() {
		err = translateErr(err)
	}()

	n, _, leftover, err := fs.lookupParentWithDepth(filename, true, 0)
	if err != nil {
		return err
	}

	parts := strings.Split(leftover, "/")
	// Make all necessary dirs.
	for _, p := range parts {
		n, _, err = fs.config.KBFSOps().CreateDir(fs.ctx, n, p)
		if err != nil {
			return err
		}
	}

	return nil
}

// OpenFile implements the billy.Filesystem interface for FS.
func (fs *FS) OpenFile(filename string, flag int, perm os.FileMode) (
	f billy.File, err error) {
	fs.log.CDebugf(
		fs.ctx, "OpenFile %s, flag=%d, perm=%o", filename, flag, perm)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "OpenFile done: %+v", err)
		err = translateErr(err)
	}()

	err = fs.mkdirAll(path.Dir(filename), 0755)
	if err != nil && !os.IsExist(err) {
		return nil, err
	}

	n, ei, err := fs.lookupOrCreateEntry(filename, flag, perm)
	if err != nil {
		return nil, err
	}

	// Make sure this is a file.
	if !ei.Type.IsFile() {
		return nil, errors.Errorf("%s is not a file", filename)
	}

	if flag&os.O_TRUNC != 0 {
		err := fs.config.KBFSOps().Truncate(fs.ctx, n, 0)
		if err != nil {
			return nil, err
		}
	}

	offset := int64(0)
	if flag&os.O_APPEND != 0 {
		if ei.Size >= uint64(1<<63) {
			return nil, errors.New("offset too large")
		}
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
func (fs *FS) Stat(filename string) (fi os.FileInfo, err error) {
	fs.log.CDebugf(fs.ctx, "Stat %s", filename)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Stat done: %+v", err)
		err = translateErr(err)
	}()

	n, ei, err := fs.lookupOrCreateEntry(filename, os.O_RDONLY, 0)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		fs:   fs,
		ei:   ei,
		name: n.GetBasename(),
	}, nil
}

// Rename implements the billy.Filesystem interface for FS.
func (fs *FS) Rename(oldpath, newpath string) (err error) {
	fs.log.CDebugf(fs.ctx, "Rename %s -> %s", oldpath, newpath)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Rename done: %+v", err)
		err = translateErr(err)
	}()

	oldParent, _, oldBase, err := fs.lookupParent(oldpath)
	if err != nil {
		return err
	}

	newParent, _, newBase, err := fs.lookupParent(newpath)
	if err != nil {
		return err
	}

	return fs.config.KBFSOps().Rename(
		fs.ctx, oldParent, oldBase, newParent, newBase)
}

// Remove implements the billy.Filesystem interface for FS.
func (fs *FS) Remove(filename string) (err error) {
	fs.log.CDebugf(fs.ctx, "Remove %s", filename)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Remove done: %+v", err)
		err = translateErr(err)
	}()

	parent, _, base, err := fs.lookupParent(filename)
	if err != nil {
		return err
	}

	_, ei, err := fs.config.KBFSOps().Lookup(fs.ctx, parent, base)
	if err != nil {
		return err
	}

	if ei.Type == libkbfs.Dir {
		return fs.config.KBFSOps().RemoveDir(fs.ctx, parent, base)
	}
	return fs.config.KBFSOps().RemoveEntry(fs.ctx, parent, base)
}

// Join implements the billy.Filesystem interface for FS.
func (fs *FS) Join(elem ...string) string {
	return path.Clean(path.Join(elem...))
}

// TempFile implements the billy.Filesystem interface for FS.
func (fs *FS) TempFile(dir, prefix string) (billy.File, error) {
	// We'd have to turn off journaling to support TempFile perfectly,
	// but the given uniq ID and a random number should be good
	// enough.  Especially since most users will end up renaming the
	// temp file before journal flushing even happens.
	b := make([]byte, 8)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}
	suffix := fs.uniqID + "-" + base64.URLEncoding.EncodeToString(b)
	return fs.OpenFile(path.Join(dir, prefix+suffix),
		os.O_CREATE|os.O_EXCL, 0600)
}

// ReadDir implements the billy.Filesystem interface for FS.
func (fs *FS) ReadDir(p string) (fis []os.FileInfo, err error) {
	fs.log.CDebugf(fs.ctx, "ReadDir %s", p)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "ReadDir done: %+v", err)
		err = translateErr(err)
	}()

	n, _, err := fs.lookupOrCreateEntry(p, os.O_RDONLY, 0)
	if err != nil {
		return nil, err
	}

	children, err := fs.config.KBFSOps().GetDirChildren(fs.ctx, n)
	if err != nil {
		return nil, err
	}

	fis = make([]os.FileInfo, 0, len(children))
	for name, ei := range children {
		fis = append(fis, &FileInfo{
			fs:   fs,
			ei:   ei,
			name: name,
		})
	}
	return fis, nil
}

// MkdirAll implements the billy.Filesystem interface for FS.
func (fs *FS) MkdirAll(filename string, perm os.FileMode) (err error) {
	fs.log.CDebugf(fs.ctx, "MkdirAll %s", filename)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "MkdirAll done: %+v", err)
	}()

	return fs.mkdirAll(filename, perm)
}

// Lstat implements the billy.Filesystem interface for FS.
func (fs *FS) Lstat(filename string) (fi os.FileInfo, err error) {
	fs.log.CDebugf(fs.ctx, "Lstat %s", filename)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Lstat done: %+v", err)
		err = translateErr(err)
	}()

	n, _, base, err := fs.lookupParent(filename)
	if err != nil {
		return nil, err
	}

	_, ei, err := fs.config.KBFSOps().Lookup(fs.ctx, n, base)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		fs:   fs,
		ei:   ei,
		name: base,
	}, nil
}

// Symlink implements the billy.Filesystem interface for FS.
func (fs *FS) Symlink(target, link string) (err error) {
	fs.log.CDebugf(fs.ctx, "Symlink target=%s link=%s", target, link)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Symlink done: %+v", err)
		err = translateErr(err)
	}()

	n, _, base, err := fs.lookupParent(link)
	if err != nil {
		return err
	}

	_, err = fs.config.KBFSOps().CreateLink(fs.ctx, n, base, target)
	return err
}

// Readlink implements the billy.Filesystem interface for FS.
func (fs *FS) Readlink(link string) (target string, err error) {
	fs.log.CDebugf(fs.ctx, "Readlink %s", link)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Readlink done: %+v", err)
		err = translateErr(err)
	}()

	n, _, base, err := fs.lookupParent(link)
	if err != nil {
		return "", err
	}

	_, ei, err := fs.config.KBFSOps().Lookup(fs.ctx, n, base)
	if err != nil {
		return "", err
	}

	if ei.Type != libkbfs.Sym {
		return "", errors.Errorf("%s is not a symlink", link)
	}
	return ei.SymPath, nil
}

// Chmod implements the billy.Filesystem interface for FS.
func (fs *FS) Chmod(name string, mode os.FileMode) (err error) {
	fs.log.CDebugf(fs.ctx, "Chmod %s %s", name, mode)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Chmod done: %+v", err)
		err = translateErr(err)
	}()

	n, _, err := fs.lookupOrCreateEntry(name, os.O_RDONLY, 0)
	if err != nil {
		return err
	}

	isExec := (mode & 0100) != 0
	return fs.config.KBFSOps().SetEx(fs.ctx, n, isExec)
}

// Lchown implements the billy.Filesystem interface for FS.
func (fs *FS) Lchown(name string, uid, gid int) error {
	// KBFS doesn't support ownership changes.
	fs.log.CDebugf(fs.ctx, "Ignoring Lchown %s %d %d", name, uid, gid)
	return nil
}

// Chown implements the billy.Filesystem interface for FS.
func (fs *FS) Chown(name string, uid, gid int) error {
	// KBFS doesn't support ownership changes.
	fs.log.CDebugf(fs.ctx, "Ignoring Chown %s %d %d", name, uid, gid)
	return nil
}

// Chtimes implements the billy.Filesystem interface for FS.
func (fs *FS) Chtimes(name string, atime time.Time, mtime time.Time) (
	err error) {
	fs.log.CDebugf(fs.ctx, "Chtimes %s mtime=%s; ignoring atime=%s",
		name, mtime, atime)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Chtimes done: %+v", err)
		err = translateErr(err)
	}()

	n, _, err := fs.lookupOrCreateEntry(name, os.O_RDONLY, 0)
	if err != nil {
		return err
	}

	return fs.config.KBFSOps().SetMtime(fs.ctx, n, &mtime)
}

// Chroot implements the billy.Filesystem interface for FS.
func (fs *FS) Chroot(p string) (newFS billy.Filesystem, err error) {
	fs.log.CDebugf(fs.ctx, "Chroot %s", p)
	defer func() {
		fs.deferLog.CDebugf(fs.ctx, "Chroot done: %+v", err)
		err = translateErr(err)
	}()

	// lookupOrCreateEntry doesn't handle "..", so we don't have to
	// worry about someone trying to break out of the jail since this
	// lookup will fail.
	n, _, err := fs.lookupOrCreateEntry(p, os.O_RDONLY, 0)
	if err != nil {
		return nil, err
	}

	return &FS{
		ctx:      fs.ctx,
		config:   fs.config,
		root:     n,
		h:        fs.h,
		subdir:   path.Clean(path.Join(fs.subdir, p)),
		log:      fs.log,
		deferLog: fs.deferLog,
	}, nil
}

// Root implements the billy.Filesystem interface for FS.
func (fs *FS) Root() string {
	return path.Join(fs.h.GetCanonicalPath(), fs.subdir)
}

// SyncAll syncs any outstanding buffered writes to the KBFS journal.
func (fs *FS) SyncAll() error {
	return fs.config.KBFSOps().SyncAll(fs.ctx, fs.root.GetFolderBranch())
}

// Config returns the underlying Config object of this FS.
func (fs *FS) Config() libkbfs.Config {
	return fs.config
}
