// Copyright 2015 Keybase Inc. All rights reserved.
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

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error) {
	fl.fs.log.CDebugf(ctx, "FL Lookup %#v", path)
	defer func() { fl.fs.reportErr(ctx, libkbfs.ReadMode, err) }()

	if len(path) == 0 {
		return oc.returnDirNoCleanup(fl)
	}

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

		fl.fs.log.CDebugf(ctx, "FL Lookup continuing")
		_, err = libkbfs.ParseTlfHandle(ctx, fl.fs.config.KBPKI(), name, fl.public)
		switch err := err.(type) {
		case nil:
			// No error.
			break

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name.
			if len(path) == 1 {
				fl.fs.log.CDebugf(ctx, "FL Lookup Alias")
				target := err.NameToTry
				d, bf, err := fl.open(ctx, oc, []string{target})
				switch {
				case err == nil && oc.isOpenReparsePoint():
					d.Cleanup(nil)
					return &Alias{canon: target}, false, nil
				case err == nil:
					return d, bf, err
				case oc.isCreateDirectory():
					fl.fs.log.CDebugf(ctx, "FL Lookup returning EmptyFolder instead of Alias")
					e := &EmptyFolder{}
					fl.lockedAddChild(name, e)
					return e, true, nil
				}
				return nil, false, err
			}
			path[0] = err.NameToTry
			continue

		case libkbfs.NoSuchNameError, libkbfs.NoSuchUserError:
			// Invalid public TLF.
			if len(path) == 1 && oc.isCreateDirectory() {
				fl.fs.log.CDebugf(ctx, "FL Lookup returning EmptyFolder instead of Alias")
				e := &EmptyFolder{}
				fl.lockedAddChild(name, e)
				return e, true, nil
			}
			return nil, false, dokan.ErrObjectNameNotFound

		case libkbfs.MDServerErrorWriteAccess:
			if len(path) == 1 {
				return oc.returnDirNoCleanup(&EmptyFolder{})
			}
			return nil, false, dokan.ErrObjectNameNotFound
		case libkbfs.WriteAccessError:
			if len(path) == 1 {
				return oc.returnDirNoCleanup(&EmptyFolder{})
			}
			return nil, false, dokan.ErrObjectNameNotFound
		default:
			// Some other error.
			return nil, false, err
		}

		fl.fs.log.CDebugf(ctx, "FL Lookup adding new child")
		child = newTLF(fl, libkbfs.CanonicalTlfName(name))
		fl.lockedAddChild(name, child)
		return child.open(ctx, oc, path[1:])
	}
	return nil, false, dokan.ErrObjectNameNotFound
}

func (fl *FolderList) forgetFolder(f *Folder) {
	fl.mu.Lock()
	defer fl.mu.Unlock()

	fl.fs.log.Info("forgetFolder %q", f.name)

	if err := fl.fs.config.Notifier().UnregisterFromChanges([]libkbfs.FolderBranch{f.folderBranch}, f); err != nil {
		fl.fs.log.Info("cannot unregister change notifier for folder %q: %v",
			f.name, err)
	}
	delete(fl.folders, string(f.name))
}

// FindFiles for dokan.
func (fl *FolderList) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx := NewContextWithOpID(fl.fs)
	fl.fs.log.CDebugf(ctx, "FL ReadDirAll")
	defer func() { fl.fs.reportErr(ctx, libkbfs.ReadMode, err) }()

	_, _, err = fl.fs.config.KBPKI().GetCurrentUserInfo(ctx)
	isLoggedIn := err == nil

	var favs []*libkbfs.Favorite
	if isLoggedIn {
		favs, err = fl.fs.config.KBFSOps().GetFavorites(ctx)
		fl.fs.log.CDebugf(ctx, "FL ReadDirAll -> %v,%v", favs, err)
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

func (fl *FolderList) lockedAddChild(name string, val fileOpener) {
	fl.mu.Lock()
	fl.folders[name] = val
	fl.mu.Unlock()
}
