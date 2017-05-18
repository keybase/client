// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
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
	fs      *FS
	tlfType tlf.Type

	mu         sync.Mutex
	folders    map[string]fileOpener
	aliasCache map[string]string
}

// GetFileInformation for dokan.
func (*FolderList) GetFileInformation(context.Context, *dokan.FileInfo) (*dokan.Stat, error) {
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

	fl.fs.config.Reporter().ReportErr(ctx, tlfName, fl.tlfType, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	fl.fs.log.CDebugf(ctx, err.Error())

}

func (fl *FolderList) addToFavorite(ctx context.Context, h *libkbfs.TlfHandle) (err error) {
	cName := h.GetCanonicalName()
	fl.fs.log.CDebugf(ctx, "adding %s to favorites", cName)
	fl.fs.config.KBFSOps().AddFavorite(ctx, h.ToFavorite())
	return nil
}

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error) {
	fl.fs.log.CDebugf(ctx, "FL Lookup %#v type=%s upper=%v",
		path, fl.tlfType, oc.isUppercasePath)
	if len(path) == 0 {
		return oc.returnDirNoCleanup(fl)
	}

	defer func() {
		fl.reportErr(ctx, libkbfs.ReadMode, libkbfs.CanonicalTlfName(path[0]), err, nil)
	}()

	// TODO: A simple lower-casing is not good enough - see CORE-2967
	// However libkbfs does this too in tlf_handle.go...
	// The case of possible redirections will be ok, so we only need
	// to do this initially.
	if c := lowerTranslateCandidate(oc, path[0]); c != "" {
		path[0] = c
	}

	for oc.reduceRedirectionsLeft() {
		name := path[0]

		if name == "desktop.ini" || name == "DESKTOP.INI" {
			fl.fs.log.CDebugf(ctx, "FL Lookup ignoring desktop.ini")
			return nil, false, dokan.ErrObjectNameNotFound
		}

		var aliasTarget string
		fl.mu.Lock()
		child, ok := fl.folders[name]
		if !ok {
			aliasTarget = fl.aliasCache[name]
		}
		fl.mu.Unlock()

		if ok {
			fl.fs.log.CDebugf(ctx, "FL Lookup recursing to child %q", name)
			return child.open(ctx, oc, path[1:])
		}

		if len(path) == 1 && isNewFolderName(name) {
			if !oc.isCreateDirectory() {
				return nil, false, dokan.ErrObjectNameNotFound
			}
			fl.fs.log.CDebugf(ctx, "FL Lookup creating EmptyFolder for Explorer")
			e := &EmptyFolder{}
			fl.lockedAddChild(name, e)
			return e, true, nil
		}

		if aliasTarget != "" {
			fl.fs.log.CDebugf(ctx, "FL Lookup aliasCache hit: %q -> %q", name, aliasTarget)
			if len(path) == 1 && oc.isOpenReparsePoint() {
				// TODO handle dir/non-dir here, semantics?
				return &Alias{canon: aliasTarget}, true, nil
			}
			path[0] = aliasTarget
			continue
		}

		h, err := libkbfs.ParseTlfHandlePreferred(
			ctx, fl.fs.config.KBPKI(), name, fl.tlfType)
		fl.fs.log.CDebugf(ctx, "FL Lookup continuing -> %v,%v", h, err)
		switch err := err.(type) {
		case nil:
			// no error

		case libkbfs.TlfNameNotCanonical:
			// Only permit Aliases to targets that contain no errors.
			aliasTarget = err.NameToTry
			fl.fs.log.CDebugf(ctx, "FL Lookup set alias: %q -> %q", name, aliasTarget)
			if !fl.isValidAliasTarget(ctx, aliasTarget) {
				fl.fs.log.CDebugf(ctx, "FL Refusing alias to non-valid target %q", aliasTarget)
				return nil, false, dokan.ErrObjectNameNotFound
			}
			fl.mu.Lock()
			fl.aliasCache[name] = aliasTarget
			fl.mu.Unlock()

			if len(path) == 1 && oc.isOpenReparsePoint() {
				// TODO handle dir/non-dir here, semantics?
				fl.fs.log.CDebugf(ctx, "FL Lookup ret alias, oc: %#v", oc.CreateData)
				return &Alias{canon: aliasTarget}, true, nil
			}
			path[0] = aliasTarget
			continue

		case libkbfs.NoSuchNameError, libkbfs.BadTLFNameError:
			return nil, false, dokan.ErrObjectNameNotFound

		default:
			// Some other error.
			return nil, false, err
		}

		fl.fs.log.CDebugf(ctx, "FL Lookup adding new child")
		session, err := libkbfs.GetCurrentSessionIfPossible(ctx, fl.fs.config.KBPKI(), h.Type() == tlf.Public)
		if err != nil {
			return nil, false, err
		}
		child = newTLF(fl, h, h.GetPreferredFormat(session.Name))
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
func (fl *FolderList) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) (err error) {
	fl.fs.logEnter(ctx, "FL FindFiles")
	defer func() { fl.fs.reportErr(ctx, libkbfs.ReadMode, err) }()

	session, err := fl.fs.config.KBPKI().GetCurrentSession(ctx)
	isLoggedIn := err == nil

	var favs []libkbfs.Favorite
	if isLoggedIn {
		favs, err = fl.fs.config.KBFSOps().GetFavorites(ctx)
		if err != nil {
			return err
		}
	}
	var ns dokan.NamedStat
	ns.FileAttributes = dokan.FileAttributeDirectory
	empty := true
	for _, fav := range favs {
		// TODO: add general types to the favorite records (or infer
		// teams somehow from the name of the favorite).
		if fav.Public != (fl.tlfType == tlf.Public) {
			continue
		}
		pname, err := libkbfs.FavoriteNameToPreferredTLFNameFormatAs(session.Name,
			libkbfs.CanonicalTlfName(fav.Name))
		if err != nil {
			fl.fs.log.Errorf("FavoriteNameToPreferredTLFNameFormatAs: %q %v", fav.Name, err)
			continue
		}
		empty = false
		ns.Name = string(pname)
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
	return libkbfs.CheckTlfHandleOffline(ctx, nameToTry, fl.tlfType) == nil
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

func (fl *FolderList) clearAliasCache() {
	fl.mu.Lock()
	fl.aliasCache = map[string]string{}
	fl.mu.Unlock()
}

func clearFolderListCacheLoop(ctx context.Context, r *Root) {
	t := time.NewTicker(time.Hour)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		r.private.clearAliasCache()
		r.public.clearAliasCache()
	}
}

// update things after user changed.
func (fl *FolderList) userChanged(ctx context.Context, _, newUser libkb.NormalizedUsername) {
	var fs []*Folder
	func() {
		fl.mu.Lock()
		defer fl.mu.Unlock()
		for _, tlf := range fl.folders {
			if tlf, ok := tlf.(*TLF); ok {
				fs = append(fs, tlf.folder)
			}
		}
	}()
	for _, f := range fs {
		f.TlfHandleChange(ctx, nil)
	}
	if newUser != libkb.NormalizedUsername("") {
		fl.fs.config.KBFSOps().ForceFastForward(ctx)
	}
}
