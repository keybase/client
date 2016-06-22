// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"sync"
	"time"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
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

func (tlf *TLF) loadDirHelper(ctx context.Context, info string, filterErr bool) (dir *Dir, exitEarly bool, err error) {
	dir = tlf.getStoredDir()
	if dir != nil {
		return dir, false, nil
	}

	tlf.dirLock.Lock()
	defer tlf.dirLock.Unlock()
	// Need to check for nilness again to avoid racing with other
	// calls to loadDir().
	if tlf.dir != nil {
		return tlf.dir, false, nil
	}

	name := tlf.folder.name()

	tlf.folder.fs.log.CDebugf(ctx, "Loading root directory for folder %s "+
		"(public: %t) for %s", name, tlf.isPublic(), info)
	defer func() {
		if filterErr {
			exitEarly, err = libfs.FilterTLFEarlyExitError(ctx, err, tlf.folder.fs.log, name)
		}

		tlf.folder.reportErr(ctx, libkbfs.ReadMode, err, nil)
	}()

	// In case there were any unresolved assertions, try them again on
	// the first load.  Otherwise, since we haven't subscribed to
	// updates yet for this folder, we might have missed a name
	// change.
	handle, err := tlf.folder.h.ResolveAgain(ctx, tlf.folder.fs.config.KBPKI())
	if err != nil {
		return nil, false, err
	}
	eq, err := tlf.folder.h.Equals(tlf.folder.fs.config.Codec(), *handle)
	if err != nil {
		return nil, false, err
	}
	if !eq {
		// Make sure the name changes in the folder and the folder list
		tlf.folder.TlfHandleChange(ctx, handle)
	}

	rootNode, _, err :=
		tlf.folder.fs.config.KBFSOps().GetOrCreateRootNode(
			ctx, handle, libkbfs.MasterBranch)
	if err != nil {
		return nil, false, err
	}

	err = tlf.folder.setFolderBranch(rootNode.GetFolderBranch())
	if err != nil {
		return nil, false, err
	}

	tlf.folder.nodes[rootNode.GetID()] = tlf
	tlf.dir = newDir(tlf.folder, rootNode, string(name), nil)
	// TLFs should be cached.
	tlf.dir.refcount.Increase()
	tlf.folder.lockedAddNode(rootNode, tlf.dir)

	return tlf.dir, false, nil
}

// loadDirAllowNonexistent loads a TLF if it's not already loaded.  If
// the TLF doesn't yet exist, it still returns a nil error and
// indicates that the calling function should pretend it's an empty
// folder.
func (tlf *TLF) loadDirAllowNonexistent(ctx context.Context, info string) (
	*Dir, bool, error) {
	return tlf.loadDirHelper(ctx, info, true)
}

// SetFileTime sets mtime for FSOs (File and Dir).
func (tlf *TLF) SetFileTime(fi *dokan.FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) (err error) {
	ctx, cancel := NewContextWithOpID(tlf.folder.fs, "TLF SetFileTime")
	defer cancel()

	dir, _, err := tlf.loadDirHelper(ctx, "TLF SetFileTime", false)
	if err != nil {
		return err
	}
	return dir.SetFileTime(fi, creation, lastAccess, lastWrite)
}

// SetFileAttributes for Dokan.
func (tlf *TLF) SetFileAttributes(fi *dokan.FileInfo, fileAttributes uint32) error {
	ctx, cancel := NewContextWithOpID(tlf.folder.fs, "TLF SetFileAttributes")
	defer cancel()
	dir, _, err := tlf.loadDirHelper(ctx, "TLF SetFileAttributes", false)
	if err != nil {
		return err
	}
	return dir.SetFileAttributes(fi, fileAttributes)

	return nil
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
	dir, exitEarly, err := tlf.loadDirAllowNonexistent(ctx, "open")
	if err != nil {
		return nil, false, err
	}
	if exitEarly {
		return nil, false, dokan.ErrObjectNameNotFound
	}
	return dir.open(ctx, oc, path)
}

// FindFiles does readdir for dokan.
func (tlf *TLF) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx, cancel := NewContextWithOpID(tlf.folder.fs, "TLF FindFiles")
	defer cancel()
	dir, exitEarly, err := tlf.loadDirAllowNonexistent(ctx, "FindFiles")
	if err != nil {
		return errToDokan(err)
	}
	if exitEarly {
		return dokan.ErrObjectNameNotFound
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
	var err error
	if fi != nil && fi.DeleteOnClose() {
		ctx, cancel := NewContextWithOpID(tlf.folder.fs, "TLF Cleanup")
		defer tlf.folder.reportErr(ctx, libkbfs.WriteMode, err, cancel)
		err = tlf.folder.fs.config.KBFSOps().DeleteFavorite(ctx, libkbfs.Favorite{
			Name:   string(tlf.folder.name()),
			Public: tlf.isPublic(),
		})
	}

	if tlf.refcount.Decrease() {
		dir := tlf.getStoredDir()
		if dir == nil {
			return
		}
		dir.Cleanup(fi)
	}
}
