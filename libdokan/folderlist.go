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

type fileOpener interface {
	open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error)
	dokan.File
}

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	emptyFile
	fs *FS
	// only accept public folders
	public bool

	mu      sync.Mutex
	folders map[string]fileOpener
}

// GetFileInformation for dokan.
func (*FolderList) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	return defaultDirectoryInformation()
}

func (fl *FolderList) reportErr(ctx context.Context,
	mode libkbfs.ErrorModeType, tlfName libkbfs.CanonicalTlfName, err error, cancelFn func()) {
	if cancelFn != nil {
		defer cancelFn()
	}
	if err == nil {
		fl.fs.log.CDebugf(ctx, "Request complete")
		return
	}

	fl.fs.config.Reporter().ReportErr(ctx, tlfName, fl.public, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	fl.fs.log.CDebugf(ctx, err.Error())

}

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error) {
	fl.fs.log.CDebugf(ctx, "FL Lookup %#v", path)
	if len(path) == 0 {
		return oc.returnDirNoCleanup(fl)
	}

	defer func() {
		fl.reportErr(ctx, libkbfs.ReadMode, libkbfs.CanonicalTlfName(path[0]), err, nil)
	}()

	for oc.reduceRedirectionsLeft() {
		name := path[0]

		if name == "desktop.ini" {
			fl.fs.log.CDebugf(ctx, "FL Lookup ignoring desktop.ini")
			return nil, false, dokan.ErrObjectNameNotFound
		}

		fl.mu.Lock()
		child, ok := fl.folders[name]
		fl.mu.Unlock()

		if ok {
			fl.fs.log.CDebugf(ctx, "FL Lookup recursing to child %q", name)
			return child.open(ctx, oc, path[1:])
		}

		if len(path) == 1 && oc.isCreateDirectory() && isNewFolderName(name) {
			fl.fs.log.CDebugf(ctx, "FL Lookup creating EmptyFolder for Explorer")
			e := &EmptyFolder{}
			fl.lockedAddChild(name, e)
			return e, true, nil
		}

		h, err := libkbfs.ParseTlfHandle(
			ctx, fl.fs.config.KBPKI(), name, fl.public)
		fl.fs.log.CDebugf(ctx, "FL Lookup continuing -> %v,%v", h, err)
		switch err := err.(type) {
		case nil:
			// No error.
			break

		case libkbfs.TlfNameNotCanonical:
			// Only permit Aliases to targets that contain no errors.
			if !fl.isValidAliasTarget(ctx, err.NameToTry) {
				fl.fs.log.CDebugf(ctx, "FL Refusing alias to non-valid target %q", err.NameToTry)
				return nil, false, dokan.ErrObjectNameNotFound
			}

			if len(path) == 1 && oc.isOpenReparsePoint() {
				// Non-canonical name.
				n := &Alias{
					canon: err.NameToTry,
				}
				return n, true, nil
			}
			path[0] = err.NameToTry
			continue

		case libkbfs.NoSuchNameError, libkbfs.BadTLFNameError:
			return nil, false, dokan.ErrObjectNameNotFound

		default:
			// Some other error.
			return nil, false, err
		}

		fl.fs.log.CDebugf(ctx, "FL Lookup adding new child")
		child = newTLF(fl, h)
		fl.lockedAddChild(name, child)
		return child.open(ctx, oc, path[1:])
	}
	return nil, false, dokan.ErrObjectNameNotFound
}

func (fl *FolderList) forgetFolder(folderName string) {
	fl.mu.Lock()
	defer fl.mu.Unlock()
	delete(fl.folders, folderName)
}

// FindFiles for dokan.
func (fl *FolderList) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx, cancel := NewContextWithOpID(fl.fs, "FL FindFiles")
	defer func() { fl.fs.reportErr(ctx, libkbfs.ReadMode, err, cancel) }()

	_, _, err = fl.fs.config.KBPKI().GetCurrentUserInfo(ctx)
	isLoggedIn := err == nil

	var favs []libkbfs.Favorite
	if isLoggedIn {
		favs, err = fl.fs.config.KBFSOps().GetFavorites(ctx)
		if err != nil {
			return err
		}
	}
	var ns dokan.NamedStat
	ns.FileAttributes = fileAttributeDirectory
	ns.NumberOfLinks = 1
	empty := true
	for _, fav := range favs {
		if fav.Public != fl.public {
			continue
		}
		empty = false
		ns.Name = fav.Name
		err = callback(&ns)
		if err != nil {
			return err
		}
	}
	if empty {
		return dokan.ErrObjectNameNotFound
	}
	return nil
}

func (fl *FolderList) isValidAliasTarget(ctx context.Context, nameToTry string) bool {
	return libkbfs.CheckTlfHandleOffline(ctx, nameToTry, fl.public) == nil
}

func (fl *FolderList) lockedAddChild(name string, val fileOpener) {
	fl.mu.Lock()
	fl.folders[name] = val
	fl.mu.Unlock()
}

func (fl *FolderList) updateTlfName(ctx context.Context, oldName string,
	newName string) {
	fl.mu.Lock()
	defer fl.mu.Unlock()
	tlf, ok := fl.folders[oldName]
	if !ok {
		return
	}

	fl.fs.log.CDebugf(ctx, "Folder name updated: %s -> %s", oldName, newName)
	delete(fl.folders, oldName)
	fl.folders[newName] = tlf
	// TODO: invalidate kernel cache for this name? (Make sure to
	// do so outside of the lock!)
}
