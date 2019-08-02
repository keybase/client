// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type fileOpener interface {
	open(ctx context.Context, oc *openContext, path []string) (
		f dokan.File, cst dokan.CreateStatus, err error)
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
	mode libkbfs.ErrorModeType, tlfName tlf.CanonicalName, err error, cancelFn func()) {
	if cancelFn != nil {
		defer cancelFn()
	}
	if err == nil {
		fl.fs.vlog.CLogf(ctx, libkb.VLog1, "Request complete")
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

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, cst dokan.CreateStatus, err error) {
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Lookup %#v type=%s upper=%v",
		path, fl.tlfType, oc.isUppercasePath)
	if len(path) == 0 {
		return oc.returnDirNoCleanup(fl)
	}

	defer func() {
		fl.reportErr(ctx, libkbfs.ReadMode, tlf.CanonicalName(path[0]), err, nil)
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
			fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Lookup ignoring desktop.ini")
			return nil, 0, dokan.ErrObjectNameNotFound
		}

		var aliasTarget string
		fl.mu.Lock()
		child, ok := fl.folders[name]
		if !ok {
			aliasTarget = fl.aliasCache[name]
		}
		fl.mu.Unlock()

		if ok {
			fl.fs.vlog.CLogf(
				ctx, libkb.VLog1, "FL Lookup recursing to child %q", name)
			return child.open(ctx, oc, path[1:])
		}

		if len(path) == 1 && isNewFolderName(name) {
			if !oc.isCreateDirectory() {
				return nil, 0, dokan.ErrObjectNameNotFound
			}
			fl.fs.vlog.CLogf(
				ctx, libkb.VLog1, "FL Lookup creating EmptyFolder for Explorer")
			e := &EmptyFolder{}
			fl.lockedAddChild(name, e)
			return e, dokan.NewDir, nil
		}

		if aliasTarget != "" {
			fl.fs.vlog.CLogf(
				ctx, libkb.VLog1, "FL Lookup aliasCache hit: %q -> %q",
				name, aliasTarget)
			if len(path) == 1 && oc.isOpenReparsePoint() {
				// TODO handle dir/non-dir here, semantics?
				return &Alias{canon: aliasTarget}, dokan.ExistingDir, nil
			}
			path[0] = aliasTarget
			continue
		}

		h, err := tlfhandle.ParseHandlePreferredQuick(
			ctx, fl.fs.config.KBPKI(), fl.fs.config, name, fl.tlfType)
		fl.fs.vlog.CLogf(
			ctx, libkb.VLog1, "FL Lookup continuing -> %v,%v", h, err)
		switch e := errors.Cause(err).(type) {
		case nil:
			// no error

		case idutil.TlfNameNotCanonical:
			// Only permit Aliases to targets that contain no errors.
			aliasTarget = e.NameToTry
			fl.fs.vlog.CLogf(
				ctx, libkb.VLog1, "FL Lookup set alias: %q -> %q",
				name, aliasTarget)
			if !fl.isValidAliasTarget(ctx, aliasTarget) {
				fl.fs.vlog.CLogf(
					ctx, libkb.VLog1,
					"FL Refusing alias to non-valid target %q", aliasTarget)
				return nil, 0, dokan.ErrObjectNameNotFound
			}
			fl.mu.Lock()
			fl.aliasCache[name] = aliasTarget
			fl.mu.Unlock()

			if len(path) == 1 && oc.isOpenReparsePoint() {
				// TODO handle dir/non-dir here, semantics?
				fl.fs.vlog.CLogf(
					ctx, libkb.VLog1, "FL Lookup ret alias, oc: %#v",
					oc.CreateData)
				return &Alias{canon: aliasTarget}, dokan.ExistingDir, nil
			}
			path[0] = aliasTarget
			continue

		case idutil.NoSuchNameError, idutil.BadTLFNameError,
			tlf.NoSuchUserError, idutil.NoSuchUserError:
			return nil, 0, dokan.ErrObjectNameNotFound

		default:
			// Some other error.
			return nil, 0, err
		}

		fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Lookup adding new child")
		session, err := idutil.GetCurrentSessionIfPossible(ctx, fl.fs.config.KBPKI(), h.Type() == tlf.Public)
		if err != nil {
			return nil, 0, err
		}
		child = newTLF(fl, h, h.GetPreferredFormat(session.Name))
		fl.lockedAddChild(name, child)
		return child.open(ctx, oc, path[1:])
	}
	return nil, 0, dokan.ErrObjectNameNotFound
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

	var favs []favorites.Folder
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
		if fav.Type != fl.tlfType {
			continue
		}
		pname, err := tlf.CanonicalToPreferredName(session.Name,
			tlf.CanonicalName(fav.Name))
		if err != nil {
			fl.fs.log.CErrorf(ctx, "CanonicalToPreferredName: %q %v", fav.Name, err)
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
	return tlfhandle.CheckHandleOffline(ctx, nameToTry, fl.tlfType) == nil
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
func (fl *FolderList) userChanged(ctx context.Context, _, newUser kbname.NormalizedUsername) {
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
	if newUser != kbname.NormalizedUsername("") {
		fl.fs.config.KBFSOps().ForceFastForward(ctx)
	}
}
