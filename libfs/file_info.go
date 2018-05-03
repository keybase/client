// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"os"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libkbfs"
)

// FileInfo is a wrapper around libkbfs.EntryInfo that implements the
// os.FileInfo interface.
type FileInfo struct {
	fs   *FS
	ei   libkbfs.EntryInfo
	node libkbfs.Node
	name string
}

var _ os.FileInfo = (*FileInfo)(nil)

// Name implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Name() string {
	return fi.name
}

// Size implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Size() int64 {
	// TODO: deal with overflow?
	return int64(fi.ei.Size)
}

// Mode implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Mode() os.FileMode {
	mode, err := WritePermMode(
		fi.fs.ctx, fi.node, os.FileMode(0), fi.fs.config.KBPKI(), fi.fs.h)
	if err != nil {
		fi.fs.log.CWarningf(
			fi.fs.ctx, "Couldn't get mode for file %s: %+v", fi.Name(), err)
		mode = os.FileMode(0)
	}

	mode |= 0400
	switch fi.ei.Type {
	case libkbfs.Dir:
		mode |= os.ModeDir | 0100
	case libkbfs.Sym:
		mode |= os.ModeSymlink
	case libkbfs.Exec:
		mode |= 0100
	}
	return mode
}

// ModTime implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) ModTime() time.Time {
	return time.Unix(0, fi.ei.Mtime)
}

// IsDir implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) IsDir() bool {
	return fi.ei.Type == libkbfs.Dir
}

// LastWriterGetter is an interface for something that can return the
// last KBFS writer of a directory entry.
type LastWriterGetter interface {
	LastWriter() (keybase1.User, error)
}

type fileInfoSys struct {
	fi *FileInfo
}

var _ LastWriterGetter = fileInfoSys{}

func (fis fileInfoSys) LastWriter() (keybase1.User, error) {
	if fis.fi.node == nil {
		// This won't return any last writer for symlinks themselves.
		// TODO: if we want symlink last writers, we'll need to add a
		// new interface to KBFSOps to get them.
		return keybase1.User{}, nil
	}
	md, err := fis.fi.fs.config.KBFSOps().GetNodeMetadata(
		fis.fi.fs.ctx, fis.fi.node)
	if err != nil {
		return keybase1.User{}, err
	}
	lastWriterName := md.LastWriterUnverified
	if lastWriterName == "" {
		// This can happen in old, buggy team folders where the writer
		// isn't properly set.  See KBFS-2939.
		return keybase1.User{}, nil
	}

	_, id, err := fis.fi.fs.config.KBPKI().Resolve(
		fis.fi.fs.ctx, lastWriterName.String())
	if err != nil {
		return keybase1.User{}, err
	}
	uid, err := id.AsUser()
	if err != nil {
		return keybase1.User{}, err
	}
	return keybase1.User{
		Uid:      uid,
		Username: lastWriterName.String(),
	}, nil
}

func (fis fileInfoSys) EntryInfo() libkbfs.EntryInfo {
	return fis.fi.ei
}

// Sys implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Sys() interface{} {
	return fileInfoSys{fi}
}
