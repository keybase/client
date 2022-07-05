// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
)

// ErrUnknownPrefetchStatus is returned when the prefetch status given by the
// KBFSOps's NodeMetadata is invalid.
var ErrUnknownPrefetchStatus = errors.New(
	"Failed to determine prefetch status")

// FileInfo is a wrapper around libkbfs.EntryInfo that implements the
// os.FileInfo interface.
type FileInfo struct {
	fs   *FS
	ei   data.EntryInfo
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
		fi.fs.ctx, fi.node, os.FileMode(0), fi.fs.config.KBPKI(),
		fi.fs.config, fi.fs.h)
	if err != nil {
		fi.fs.log.CWarningf(
			fi.fs.ctx, "Couldn't get mode for file %s: %+v", fi.Name(), err)
		mode = os.FileMode(0)
	}

	mode |= 0400
	switch fi.ei.Type {
	case data.Dir:
		mode |= os.ModeDir | 0100
	case data.Sym:
		mode |= os.ModeSymlink
	case data.Exec:
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
	return fi.ei.Type == data.Dir
}

// KBFSMetadataForSimpleFS contains the KBFS metadata needed to answer a
// simpleFSStat call.
type KBFSMetadataForSimpleFS struct {
	LastWriter       keybase1.User
	PrefetchStatus   keybase1.PrefetchStatus
	PrefetchProgress libkbfs.PrefetchProgress
}

// KBFSMetadataForSimpleFSGetter is an interface for something that can return
// the last KBFS writer and prefetch status of a directory entry.
type KBFSMetadataForSimpleFSGetter interface {
	KBFSMetadataForSimpleFS() (KBFSMetadataForSimpleFS, error)
}

// PrevRevisionsGetter is an interface for something that can return
// the previous revisions of an entry.
type PrevRevisionsGetter interface {
	PrevRevisions() data.PrevRevisions
}

type fileInfoSys struct {
	fi *FileInfo
}

var _ KBFSMetadataForSimpleFSGetter = fileInfoSys{}

func (fis fileInfoSys) KBFSMetadataForSimpleFS() (
	KBFSMetadataForSimpleFS, error) {
	if fis.fi.node == nil {
		// This won't return any last writer for symlinks themselves.
		// TODO: if we want symlink last writers, we'll need to add a
		// new interface to KBFSOps to get them.
		return KBFSMetadataForSimpleFS{}, nil
	}
	md, err := fis.fi.fs.config.KBFSOps().GetNodeMetadata(
		fis.fi.fs.ctx, fis.fi.node)
	if err != nil {
		return KBFSMetadataForSimpleFS{}, err
	}

	prefetchStatus := md.PrefetchStatus.ToProtocolStatus()
	status := KBFSMetadataForSimpleFS{PrefetchStatus: prefetchStatus}
	if md.PrefetchProgress != nil {
		status.PrefetchProgress = *md.PrefetchProgress
	}

	lastWriterName := md.LastWriterUnverified
	if lastWriterName == "" {
		// This can happen in old, buggy team folders where the writer
		// isn't properly set.  See KBFS-2939.
		return status, nil
	}

	_, id, err := fis.fi.fs.config.KBPKI().Resolve(
		fis.fi.fs.ctx, lastWriterName.String(),
		fis.fi.fs.config.OfflineAvailabilityForID(
			fis.fi.fs.root.GetFolderBranch().Tlf))
	if err != nil {
		return KBFSMetadataForSimpleFS{}, err
	}
	uid, err := id.AsUser()
	if err != nil {
		return KBFSMetadataForSimpleFS{}, err
	}

	status.LastWriter = keybase1.User{
		Uid:      uid,
		Username: lastWriterName.String(),
	}
	return status, nil
}

var _ PrevRevisionsGetter = fileInfoSys{}

func (fis fileInfoSys) PrevRevisions() (revs data.PrevRevisions) {
	return fis.fi.ei.PrevRevisions
}

func (fis fileInfoSys) EntryInfo() data.EntryInfo {
	return fis.fi.ei
}

// Sys implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Sys() interface{} {
	return fileInfoSys{fi}
}

// FileInfoFast always returns a returns a read-only mode, and doesn't populate
// LastWriterUnverified. This allows us to avoid doing a Lookup on the entry,
// which makes a big difference in ReadDir.
type FileInfoFast struct {
	ei   data.EntryInfo
	name string
}

// Name implements the os.FileInfo interface.
func (fif *FileInfoFast) Name() string {
	return fif.name
}

// Size implements the os.FileInfo interface.
func (fif *FileInfoFast) Size() int64 {
	// TODO: deal with overflow?
	return int64(fif.ei.Size)
}

// Mode implements the os.FileInfo interface.
func (fif *FileInfoFast) Mode() os.FileMode {
	mode := os.FileMode(0400)
	switch fif.ei.Type {
	case data.Dir:
		mode |= os.ModeDir | 0100
	case data.Sym:
		mode |= os.ModeSymlink
	case data.Exec:
		mode |= 0100
	}
	return mode
}

// ModTime implements the os.FileInfo interface.
func (fif *FileInfoFast) ModTime() time.Time {
	return time.Unix(0, fif.ei.Mtime)
}

// IsDir implements the os.FileInfo interface.
func (fif *FileInfoFast) IsDir() bool {
	return fif.ei.Type == data.Dir
}

// Sys implements the os.FileInfo interface.
func (fif *FileInfoFast) Sys() interface{} {
	return fif
}

type ctxFastModeKey struct{}

// EnableFastMode returns a context.Context based on ctx that will test to true
// with IsFastModeEnabled.
func EnableFastMode(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxFastModeKey{}, true)
}

// IsFastModeEnabled returns true if fast mode should be enabled. In fast mode,
// *FS doesn't populate LastWriterUnverified, and always returns read-only
// info. All *FS created under this ctx will also be in fast mode.
func IsFastModeEnabled(ctx context.Context) bool {
	v, ok := ctx.Value(ctxFastModeKey{}).(bool)
	return ok && v
}
