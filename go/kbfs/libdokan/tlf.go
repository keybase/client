// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
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

func newTLF(fl *FolderList, h *tlfhandle.Handle,
	name tlf.PreferredName) *TLF {
	folder := newFolder(fl, h, name)
	tlf := &TLF{
		folder: folder,
	}
	tlf.refcount.Increase()
	return tlf
}

func (tlf *TLF) getStoredDir() *Dir {
	tlf.dirLock.RLock()
	defer tlf.dirLock.RUnlock()
	return tlf.dir
}

func (tlf *TLF) loadDirHelper(ctx context.Context, info string,
	mode libkbfs.ErrorModeType, branch data.BranchName, filterErr bool) (
	dir *Dir, exitEarly bool, err error) {
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
		"(type: %s, filter error: %t) for %s",
		name, tlf.folder.list.tlfType, filterErr, info)
	defer func() {
		if filterErr {
			exitEarly, err = libfs.FilterTLFEarlyExitError(ctx, err, tlf.folder.fs.log, name)
		}

		tlf.folder.reportErr(ctx, mode, err)
	}()

	handle, err := tlf.folder.resolve(ctx)
	if err != nil {
		return nil, false, err
	}

	if branch == data.MasterBranch {
		conflictBranch, isLocalConflictBranch :=
			data.MakeConflictBranchName(handle)
		if isLocalConflictBranch {
			branch = conflictBranch
		}
	}

	var rootNode libkbfs.Node
	if filterErr {
		rootNode, _, err = tlf.folder.fs.config.KBFSOps().GetRootNode(
			ctx, handle, branch)
		if err != nil {
			return nil, false, err
		}
		// If not fake an empty directory.
		if rootNode == nil {
			return nil, false, libfs.TlfDoesNotExist{}
		}
	} else {
		rootNode, _, err = tlf.folder.fs.config.KBFSOps().GetOrCreateRootNode(
			ctx, handle, branch)
		if err != nil {
			return nil, false, err
		}
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

func (tlf *TLF) loadDir(ctx context.Context, info string) (*Dir, error) {
	dir, _, err := tlf.loadDirHelper(
		ctx, info, libkbfs.WriteMode, data.MasterBranch, false)
	return dir, err
}

// loadDirAllowNonexistent loads a TLF if it's not already loaded.  If
// the TLF doesn't yet exist, it still returns a nil error and
// indicates that the calling function should pretend it's an empty
// folder.
func (tlf *TLF) loadDirAllowNonexistent(ctx context.Context, info string) (
	*Dir, bool, error) {
	return tlf.loadDirHelper(
		ctx, info, libkbfs.ReadMode, data.MasterBranch, true)
}

func (tlf *TLF) loadArchivedDir(
	ctx context.Context, info string, branch data.BranchName) (
	*Dir, bool, error) {
	// Always filter errors for archive TLF directories, so that we
	// don't try to initialize them.
	return tlf.loadDirHelper(ctx, info, libkbfs.ReadMode, branch, true)
}

// SetFileTime sets mtime for FSOs (File and Dir).
func (tlf *TLF) SetFileTime(ctx context.Context, fi *dokan.FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) (err error) {
	tlf.folder.fs.logEnter(ctx, "TLF SetFileTime")

	dir, err := tlf.loadDir(ctx, "TLF SetFileTime")
	if err != nil {
		return err
	}
	return dir.SetFileTime(ctx, fi, creation, lastAccess, lastWrite)
}

// SetFileAttributes for Dokan.
func (tlf *TLF) SetFileAttributes(ctx context.Context, fi *dokan.FileInfo, fileAttributes dokan.FileAttribute) error {
	tlf.folder.fs.logEnter(ctx, "TLF SetFileAttributes")
	dir, err := tlf.loadDir(ctx, "TLF SetFileAttributes")
	if err != nil {
		return err
	}
	return dir.SetFileAttributes(ctx, fi, fileAttributes)
}

// GetFileInformation for dokan.
func (tlf *TLF) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (st *dokan.Stat, err error) {
	dir := tlf.getStoredDir()
	if dir == nil {
		return defaultDirectoryInformation()
	}

	return dir.GetFileInformation(ctx, fi)
}

// open tries to open a file.
func (tlf *TLF) open(ctx context.Context, oc *openContext, path []string) (
	dokan.File, dokan.CreateStatus, error) {
	if len(path) == 0 {
		if err := oc.ReturningDirAllowed(); err != nil {
			return nil, 0, err
		}
		tlf.refcount.Increase()
		return tlf, dokan.ExistingDir, nil
	}

	mode := libkbfs.ReadMode
	if oc.isCreation() {
		mode = libkbfs.WriteMode
	}
	// If it is a creation then we need the dir for real.
	dir, exitEarly, err :=
		tlf.loadDirHelper(
			ctx, "open", mode, data.MasterBranch, !oc.isCreation())
	if err != nil {
		return nil, 0, err
	}
	if exitEarly {
		specialNode := handleTLFSpecialFile(lastStr(path), tlf.folder)
		if specialNode != nil {
			return specialNode, dokan.ExistingFile, nil
		}

		return nil, 0, dokan.ErrObjectNameNotFound
	}

	branch, isArchivedBranch := libfs.BranchNameFromArchiveRefDir(path[0])
	if isArchivedBranch {
		archivedTLF := newTLF(
			tlf.folder.list, tlf.folder.h, tlf.folder.hPreferredName)
		_, _, err := archivedTLF.loadArchivedDir(ctx, "open", branch)
		if err != nil {
			return nil, 0, err
		}
		return archivedTLF.open(ctx, oc, path[1:])
	}

	linkTarget, isArchivedTimeLink, err := libfs.LinkTargetFromTimeString(
		ctx, tlf.folder.fs.config, tlf.folder.h, path[0])
	if err != nil {
		return nil, 0, err
	}
	if isArchivedTimeLink {
		if len(path) == 1 && oc.isOpenReparsePoint() {
			// TODO handle dir/non-dir here, semantics?
			return &Alias{canon: linkTarget}, dokan.ExistingDir, nil
		}
		path[0] = linkTarget
		return tlf.open(ctx, oc, path)
	}

	_, isRelTimeLink, err := libfs.FileDataFromRelativeTimeString(
		ctx, tlf.folder.fs.config, tlf.folder.h, path[0])
	if err != nil {
		return nil, 0, err
	}
	if isRelTimeLink {
		return NewArchiveRelTimeFile(tlf.folder.fs, tlf.folder.h, path[0]),
			dokan.ExistingFile, nil
	}

	return dir.open(ctx, oc, path)
}

// FindFiles does readdir for dokan.
func (tlf *TLF) FindFiles(ctx context.Context, fi *dokan.FileInfo, pattern string, callback func(*dokan.NamedStat) error) (err error) {
	tlf.folder.fs.logEnter(ctx, "TLF FindFiles")
	dir, exitEarly, err := tlf.loadDirAllowNonexistent(ctx, "FindFiles")
	if err != nil {
		return errToDokan(err)
	}
	if exitEarly {
		return dokan.ErrObjectNameNotFound
	}
	return dir.FindFiles(ctx, fi, pattern, callback)
}

// CanDeleteDirectory - return just nil because tlfs
// can always be removed from favorites.
func (tlf *TLF) CanDeleteDirectory(ctx context.Context, fi *dokan.FileInfo) (err error) {
	return nil
}

// Cleanup - forget references, perform deletions etc.
func (tlf *TLF) Cleanup(ctx context.Context, fi *dokan.FileInfo) {
	var err error
	if fi != nil && fi.IsDeleteOnClose() {
		tlf.folder.handleMu.Lock()
		fav := tlf.folder.h.ToFavorite()
		tlf.folder.handleMu.Unlock()
		tlf.folder.fs.vlog.CLogf(
			ctx, libkb.VLog1, "TLF Removing favorite %q", fav.Name)
		defer func() {
			tlf.folder.reportErr(ctx, libkbfs.WriteMode, err)
		}()
		err = tlf.folder.fs.config.KBFSOps().DeleteFavorite(ctx, fav)
	}

	if tlf.refcount.Decrease() {
		dir := tlf.getStoredDir()
		if dir == nil {
			return
		}
		dir.Cleanup(ctx, fi)
	}
}
