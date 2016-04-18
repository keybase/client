// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"sync"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// TLF represents the root directory of a TLF. It wraps a lazy-loaded
// Dir.
type TLF struct {
	refcount refcount

	folder *Folder

	dirLock sync.RWMutex
	dir     *Dir

	emptyFile
}

func newTLF(fl *FolderList, h *libkbfs.TlfHandle) *TLF {
	folder := newFolder(fl, h)
	tlf := &TLF{
		folder: folder,
	}
	tlf.refcount.Increase()
	return tlf
}

func (tlf *TLF) isPublic() bool {
	return tlf.folder.list.public
}

func (tlf *TLF) getStoredDir() *Dir {
	tlf.dirLock.RLock()
	defer tlf.dirLock.RUnlock()
	return tlf.dir
}

func (tlf *TLF) loadDir(ctx context.Context, info string) (dir *Dir, err error) {
	dir = tlf.getStoredDir()
	if dir != nil {
		return dir, nil
	}

	tlf.dirLock.Lock()
	defer tlf.dirLock.Unlock()
	// Need to check for nilness again to avoid racing with other
	// calls to loadDir().
	if tlf.dir != nil {
		return tlf.dir, nil
	}

	name := tlf.folder.name(ctx)

	tlf.folder.fs.log.CDebugf(ctx, "Loading root directory for folder %s "+
		"(public: %t) for %s", name, tlf.isPublic(), info)
	defer func() { tlf.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	rootNode, _, err :=
		tlf.folder.fs.config.KBFSOps().GetOrCreateRootNode(
			ctx, tlf.folder.h, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}

	err = tlf.folder.setFolderBranch(rootNode.GetFolderBranch())
	if err != nil {
		return nil, err
	}

	tlf.folder.nodes[rootNode.GetID()] = tlf
	tlf.dir = newDir(tlf.folder, rootNode, string(name), nil)
	// TLFs should be cached.
	tlf.dir.refcount.Increase()
	tlf.folder.lockedAddNode(rootNode, tlf.dir)

	return tlf.dir, nil
}

// GetFileInformation for dokan.
func (tlf *TLF) GetFileInformation(fi *dokan.FileInfo) (st *dokan.Stat, err error) {
	dir := tlf.getStoredDir()
	if dir == nil {
		return defaultDirectoryInformation()
	}

	return dir.GetFileInformation(fi)
}

// open tries to open a file.
func (tlf *TLF) open(ctx context.Context, oc *openContext, path []string) (dokan.File, bool, error) {
	if len(path) == 0 {
		if oc.mayNotBeDirectory() {
			return nil, true, dokan.ErrFileIsADirectory
		}
		tlf.refcount.Increase()
		return tlf, true, nil
	}
	dir, err := tlf.loadDir(ctx, "open")
	if err != nil {
		return nil, false, err
	}
	return dir.open(ctx, oc, path)
}

// FindFiles does readdir for dokan.
func (tlf *TLF) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx := NewContextWithOpID(tlf.folder.fs)
	dir, err := tlf.loadDir(ctx, "FindFiles")
	if err != nil {
		return errToDokan(err)
	}
	return dir.FindFiles(fi, callback)
}

// CanDeleteDirectory - return just nil because tlfs
// can always be removed from favorites.
func (tlf *TLF) CanDeleteDirectory(*dokan.FileInfo) (err error) {
	return nil
}

// Cleanup - forget references, perform deletions etc.
func (tlf *TLF) Cleanup(fi *dokan.FileInfo) {
	if fi != nil && fi.DeleteOnClose() {
		ctx := NewContextWithOpID(tlf.folder.fs)
		err := tlf.folder.fs.config.KBFSOps().DeleteFavorite(ctx,
			string(tlf.folder.name(ctx)), tlf.isPublic())
		tlf.folder.reportErr(ctx, libkbfs.WriteMode, err)
	}

	if tlf.refcount.Decrease() {
		dir := tlf.getStoredDir()
		if dir == nil {
			return
		}
		dir.Cleanup(fi)
	}
}
