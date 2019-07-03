// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"net/http"
	"os"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/pkg/errors"
)

type dir struct {
	fs      *FS
	dirname string
	node    libkbfs.Node
}

// Readdir reads children from d.
func (d *dir) Readdir(count int) (fis []os.FileInfo, err error) {
	d.fs.log.CDebugf(d.fs.ctx, "ReadDir %s", count)
	defer func() {
		d.fs.deferLog.CDebugf(d.fs.ctx, "ReadDir done: %+v", err)
		err = translateErr(err)
	}()

	return d.fs.readDir(d.node)
}

// fileOrDir is a wrapper around billy FS types that satisfies http.File, which
// is either a file or a dir.
type fileOrDir struct {
	file *File
	dir  *dir
	ei   data.EntryInfo
}

var _ http.File = fileOrDir{}

// fileOrDir implements the http.File interface.
func (fod fileOrDir) Read(p []byte) (n int, err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()
	if fod.file == nil {
		return 0, libkbfs.NotFileError{}
	}
	return fod.file.Read(p)
}

// Close implements the http.File interface.
func (fod fileOrDir) Close() (err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()
	if fod.file != nil {
		err = fod.file.Close()
	}
	if fod.dir != nil {
		fod.dir.node = nil
	}
	fod.file = nil
	fod.dir = nil
	return err
}

// Seek implements the http.File interface.
func (fod fileOrDir) Seek(offset int64, whence int) (n int64, err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()
	if fod.file == nil {
		return 0, libkbfs.NotFileError{}
	}
	return fod.file.Seek(offset, whence)
}

// Readdir implements the http.File interface.
func (fod fileOrDir) Readdir(count int) (fis []os.FileInfo, err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()
	if fod.dir == nil {
		return nil, libkbfs.NotDirError{}
	}
	return fod.dir.Readdir(count)
}

// Stat implements the http.File interface.
func (fod fileOrDir) Stat() (fi os.FileInfo, err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()
	if fod.file != nil {
		return &FileInfo{
			fs:   fod.file.fs,
			ei:   fod.ei,
			node: fod.file.node,
			name: fod.file.node.GetBasename().Plaintext(),
		}, nil
	} else if fod.dir != nil {
		return &FileInfo{
			fs:   fod.dir.fs,
			ei:   fod.ei,
			node: fod.dir.node,
			name: fod.dir.node.GetBasename().Plaintext(),
		}, nil
	}
	return nil, errors.New("invalid fod")
}

// httpFileSystem is a simple wrapper around *FS that satisfies http.FileSystem
// interface.
type httpFileSystem struct {
	fs *FS
}

var _ http.FileSystem = httpFileSystem{}

// Open implements the http.FileSystem interface.
func (hfs httpFileSystem) Open(filename string) (entry http.File, err error) {
	hfs.fs.log.CDebugf(
		hfs.fs.ctx, "hfs.Open %s", hfs.fs.PathForLogging(filename))
	defer func() {
		hfs.fs.deferLog.CDebugf(hfs.fs.ctx, "hfs.Open done: %+v", err)
		if err != nil {
			err = translateErr(err)
		}
	}()

	n, ei, err := hfs.fs.lookupOrCreateEntry(filename, os.O_RDONLY, 0600)
	if err != nil {
		return fileOrDir{}, err
	}

	if ei.Type.IsFile() {
		return fileOrDir{
			file: &File{
				fs:       hfs.fs,
				filename: n.GetBasename().Plaintext(),
				node:     n,
				readOnly: true,
				offset:   0,
			},
			ei: ei,
		}, nil
	}
	return fileOrDir{
		dir: &dir{
			fs:      hfs.fs,
			dirname: n.GetBasename().Plaintext(),
			node:    n,
		},
		ei: ei,
	}, nil
}
