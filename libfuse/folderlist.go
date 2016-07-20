// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"os"
	"strings"
	"sync"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	fs *FS
	// only accept public folders
	public bool

	mu      sync.Mutex
	folders map[string]*TLF

	muRecentlyRemoved sync.RWMutex
	recentlyRemoved   map[libkbfs.CanonicalTlfName]bool
}

var _ fs.Node = (*FolderList)(nil)

// Attr implements the fs.Node interface.
func (*FolderList) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = (*FolderList)(nil)

func (fl *FolderList) reportErr(ctx context.Context,
	mode libkbfs.ErrorModeType, tlfName libkbfs.CanonicalTlfName, err error) {
	if err == nil {
		fl.fs.errLog.CDebugf(ctx, "Request complete")
		return
	}

	fl.fs.config.Reporter().ReportErr(ctx, tlfName, fl.public, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	fl.fs.errLog.CDebugf(ctx, err.Error())
}

func (fl *FolderList) addToRecentlyRemoved(name libkbfs.CanonicalTlfName) {
	func() {
		fl.muRecentlyRemoved.Lock()
		defer fl.muRecentlyRemoved.Unlock()
		if fl.recentlyRemoved == nil {
			fl.recentlyRemoved = make(map[libkbfs.CanonicalTlfName]bool)
		}
		fl.recentlyRemoved[name] = true
	}()
	fl.fs.execAfterDelay(time.Second, func() {
		fl.muRecentlyRemoved.Lock()
		defer fl.muRecentlyRemoved.Unlock()
		delete(fl.recentlyRemoved, name)
	})
}

func (fl *FolderList) isRecentlyRemoved(name libkbfs.CanonicalTlfName) bool {
	fl.muRecentlyRemoved.RLock()
	defer fl.muRecentlyRemoved.RUnlock()
	return fl.recentlyRemoved != nil && fl.recentlyRemoved[name]
}

func (fl *FolderList) addToFavorite(ctx context.Context, h *libkbfs.TlfHandle) (err error) {
	cName := h.GetCanonicalName()

	// `rmdir` command on macOS does a lookup after removing the dir. if the
	// TLF is recently removed, it's likely that this lookup is issued by the
	// `rmdir` command, and the lookup should not result in adding the dir to
	// favorites.
	if !fl.isRecentlyRemoved(cName) {
		fl.fs.log.CDebugf(ctx, "adding %s to favorites", cName)
		fl.fs.config.KBFSOps().AddFavorite(ctx, h.ToFavorite())
	} else {
		fl.fs.log.CDebugf(ctx, "recently removed; will skip adding %s to favorites and return ENOENT", cName)
		return fuse.ENOENT
	}
	return nil
}

// Lookup implements the fs.NodeRequestLookuper interface.
func (fl *FolderList) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	fl.fs.log.CDebugf(ctx, "FL Lookup %s", req.Name)
	defer func() {
		fl.reportErr(ctx, libkbfs.ReadMode,
			libkbfs.CanonicalTlfName(req.Name), err)
	}()
	fl.mu.Lock()
	defer fl.mu.Unlock()

	specialNode := handleSpecialFile(req.Name, fl.fs, resp)
	if specialNode != nil {
		return specialNode, nil
	}

	if child, ok := fl.folders[req.Name]; ok {
		return child, nil
	}

	// Shortcut for dreaded extraneous OSX finder lookups
	if strings.HasPrefix(req.Name, "._") {
		return nil, fuse.ENOENT
	}

	h, err := libkbfs.ParseTlfHandle(
		ctx, fl.fs.config.KBPKI(), req.Name, fl.public)
	switch err := err.(type) {
	case nil:
		// no error

	case libkbfs.TlfNameNotCanonical:

		// Only permit Aliases to targets that contain no errors.
		if !fl.isValidAliasTarget(ctx, err.NameToTry) {
			fl.fs.log.CDebugf(ctx, "FL Refusing alias to non-valid target %q", err.NameToTry)
			return nil, fuse.ENOENT
		}
		// Non-canonical name.
		n := &Alias{
			canon: err.NameToTry,
		}
		return n, nil

	case libkbfs.NoSuchNameError, libkbfs.BadTLFNameError:
		// Invalid public TLF.
		return nil, fuse.ENOENT

	default:
		// Some other error.
		return nil, err
	}

	child := newTLF(fl, h)
	fl.folders[req.Name] = child
	return child, nil
}

func (fl *FolderList) isValidAliasTarget(ctx context.Context, nameToTry string) bool {
	return libkbfs.CheckTlfHandleOffline(ctx, nameToTry, fl.public) == nil
}

func (fl *FolderList) forgetFolder(folderName string) {
	fl.mu.Lock()
	defer fl.mu.Unlock()
	delete(fl.folders, folderName)
}

var _ fs.Handle = (*FolderList)(nil)

var _ fs.HandleReadDirAller = (*FolderList)(nil)

// ReadDirAll implements the ReadDirAll interface.
func (fl *FolderList) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	fl.fs.log.CDebugf(ctx, "FL ReadDirAll")
	defer func() {
		fl.fs.reportErr(ctx, libkbfs.ReadMode, err)
	}()
	_, _, err = fl.fs.config.KBPKI().GetCurrentUserInfo(ctx)
	isLoggedIn := err == nil

	var favs []libkbfs.Favorite
	if isLoggedIn {
		favs, err = fl.fs.config.KBFSOps().GetFavorites(ctx)
		if err != nil {
			return nil, err
		}
	}

	res = make([]fuse.Dirent, 0, len(favs))
	for _, fav := range favs {
		if fav.Public != fl.public {
			continue
		}
		res = append(res, fuse.Dirent{
			Type: fuse.DT_Dir,
			Name: fav.Name,
		})
	}
	return res, nil
}

var _ fs.NodeRemover = (*FolderList)(nil)

// Remove implements the fs.NodeRemover interface for FolderList.
func (fl *FolderList) Remove(ctx context.Context, req *fuse.RemoveRequest) (err error) {
	fl.fs.log.CDebugf(ctx, "FolderList Remove %s", req.Name)
	defer func() { fl.fs.reportErr(ctx, libkbfs.WriteMode, err) }()

	h, err := libkbfs.ParseTlfHandle(
		ctx, fl.fs.config.KBPKI(), req.Name, fl.public)

	switch err := err.(type) {
	case nil:
		func() {
			fl.mu.Lock()
			defer fl.mu.Unlock()
			if tlf, ok := fl.folders[req.Name]; ok {
				// Fake future attr calls for this TLF until the user
				// actually opens the TLF again, because some OSes (*cough
				// OS X cough*) like to do immediate lookup/attr calls
				// right after doing a remove, which would otherwise end
				// up re-adding the favorite.
				tlf.clearStoredDir()
			}
		}()

		// TODO how to handle closing down the folderbranchops
		// object? Open files may still exist long after removing
		// the favorite.
		return fl.fs.config.KBFSOps().DeleteFavorite(ctx, h.ToFavorite())

	case libkbfs.TlfNameNotCanonical:
		return nil

	default:
		return err
	}
}

func isTlfNameNotCanonical(err error) bool {
	_, ok := err.(libkbfs.TlfNameNotCanonical)
	return ok
}

func (fl *FolderList) updateTlfName(ctx context.Context, oldName string,
	newName string) {
	ok := func() bool {
		fl.mu.Lock()
		defer fl.mu.Unlock()
		tlf, ok := fl.folders[oldName]
		if !ok {
			return false
		}

		fl.fs.log.CDebugf(ctx, "Folder name updated: %s -> %s", oldName, newName)
		delete(fl.folders, oldName)
		fl.folders[newName] = tlf
		return true
	}()
	if !ok {
		return
	}

	if err := fl.fs.fuse.InvalidateEntry(fl, oldName); err != nil {
		// TODO we have no mechanism to do anything about this
		fl.fs.log.CErrorf(ctx, "FUSE invalidate error for oldName=%s: %v",
			oldName, err)
	}
	if err := fl.fs.fuse.InvalidateEntry(fl, newName); err != nil {
		// TODO we have no mechanism to do anything about this
		fl.fs.log.CErrorf(ctx, "FUSE invalidate error for newName=%s: %v",
			newName, err)
	}
}
