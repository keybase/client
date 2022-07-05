// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"syscall"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
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

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	fs *FS
	// only accept public folders
	tlfType tlf.Type
	inode   uint64

	mu      sync.Mutex
	folders map[string]*TLF
}

var _ fs.NodeAccesser = (*FolderList)(nil)

// Access implements fs.NodeAccesser interface for *FolderList.
func (*FolderList) Access(ctx context.Context, r *fuse.AccessRequest) error {
	if int(r.Uid) != os.Getuid() &&
		// Finder likes to use UID 0 for some operations. osxfuse already allows
		// ACCESS and GETXATTR requests from root to go through. This allows root
		// in ACCESS handler. See KBFS-1733 for more details.
		int(r.Uid) != 0 {
		// short path: not accessible by anybody other than root or the user who
		// executed the kbfsfuse process.
		return fuse.EPERM
	}

	if r.Mask&02 != 0 {
		return fuse.EPERM
	}

	return nil
}

var _ fs.Node = (*FolderList)(nil)

// Attr implements the fs.Node interface.
func (fl *FolderList) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0500
	a.Uid = uint32(os.Getuid())
	a.Inode = fl.inode
	return nil
}

var _ fs.NodeRequestLookuper = (*FolderList)(nil)

func (fl *FolderList) processError(ctx context.Context,
	mode libkbfs.ErrorModeType, tlfName tlf.CanonicalName, err error) error {
	if err == nil {
		fl.fs.errLog.CDebugf(ctx, "Request complete")
		return nil
	}

	fl.fs.config.Reporter().ReportErr(ctx, tlfName, fl.tlfType, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	fl.fs.errLog.CDebugf(ctx, err.Error())
	return filterError(err)
}

// PathType returns PathType for this folder
func (fl *FolderList) PathType() tlfhandle.PathType {
	switch fl.tlfType {
	case tlf.Private:
		return tlfhandle.PrivatePathType
	case tlf.Public:
		return tlfhandle.PublicPathType
	case tlf.SingleTeam:
		return tlfhandle.SingleTeamPathType
	default:
		panic(fmt.Sprintf("Unsupported tlf type: %s", fl.tlfType))
	}
}

// Create implements the fs.NodeCreater interface for FolderList.
func (fl *FolderList) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (_ fs.Node, _ fs.Handle, err error) {
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Create")
	tlfName := tlf.CanonicalName(req.Name)
	defer func() { err = fl.processError(ctx, libkbfs.WriteMode, tlfName, err) }()
	if strings.HasPrefix(req.Name, "._") {
		// Quietly ignore writes to special macOS files, without
		// triggering a notification.
		return nil, nil, syscall.ENOENT
	}
	return nil, nil, libkbfs.NewWriteUnsupportedError(tlfhandle.BuildCanonicalPath(fl.PathType(), string(tlfName)))
}

// Mkdir implements the fs.NodeMkdirer interface for FolderList.
func (fl *FolderList) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (_ fs.Node, err error) {
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Mkdir")
	tlfName := tlf.CanonicalName(req.Name)
	defer func() { err = fl.processError(ctx, libkbfs.WriteMode, tlfName, err) }()
	return nil, libkbfs.NewWriteUnsupportedError(tlfhandle.BuildCanonicalPath(fl.PathType(), string(tlfName)))
}

// Lookup implements the fs.NodeRequestLookuper interface.
func (fl *FolderList) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL Lookup %s", req.Name)
	defer func() {
		err = fl.processError(ctx, libkbfs.ReadMode,
			tlf.CanonicalName(req.Name), err)
	}()
	fl.mu.Lock()
	defer fl.mu.Unlock()

	specialNode := handleNonTLFSpecialFile(
		req.Name, fl.fs, &resp.EntryValid)
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

	h, err := tlfhandle.ParseHandlePreferredQuick(
		ctx, fl.fs.config.KBPKI(), fl.fs.config, req.Name, fl.tlfType)
	switch e := errors.Cause(err).(type) {
	case nil:
		// no error

	case idutil.TlfNameNotCanonical:
		// Only permit Aliases to targets that contain no errors.
		if !fl.isValidAliasTarget(ctx, e.NameToTry) {
			fl.fs.log.CDebugf(ctx, "FL Refusing alias to non-valid target %q", e.NameToTry)
			return nil, fuse.ENOENT
		}
		// Non-canonical name.
		n := &Alias{
			realPath: e.NameToTry,
			inode:    0,
		}
		return n, nil

	case idutil.NoSuchNameError, idutil.BadTLFNameError,
		tlf.NoSuchUserError, idutil.NoSuchUserError:
		// Invalid TLF.
		return nil, fuse.ENOENT

	default:
		// Some other error.
		return nil, err
	}

	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, fl.fs.config.KBPKI(), h.Type() == tlf.Public)
	if err != nil {
		return nil, err
	}
	child := newTLF(ctx, fl, h, h.GetPreferredFormat(session.Name))
	fl.folders[req.Name] = child
	return child, nil
}

func (fl *FolderList) isValidAliasTarget(ctx context.Context, nameToTry string) bool {
	return tlfhandle.CheckHandleOffline(ctx, nameToTry, fl.tlfType) == nil
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
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FL ReadDirAll")
	defer func() {
		err = fl.fs.processError(ctx, libkbfs.ReadMode, err)
	}()
	session, err := fl.fs.config.KBPKI().GetCurrentSession(ctx)
	isLoggedIn := err == nil

	var favs []favorites.Folder
	if isLoggedIn {
		favs, err = fl.fs.config.KBFSOps().GetFavorites(ctx)
		if err != nil {
			return nil, err
		}
	}

	res = make([]fuse.Dirent, 0, len(favs))
	for _, fav := range favs {
		if fav.Type != fl.tlfType {
			continue
		}
		pname, err := tlf.CanonicalToPreferredName(
			session.Name, tlf.CanonicalName(fav.Name))
		if err != nil {
			fl.fs.log.Errorf("CanonicalToPreferredName: %q %v", fav.Name, err)
			continue
		}
		res = append(res, fuse.Dirent{
			Type: fuse.DT_Dir,
			Name: string(pname),
		})
	}
	return res, nil
}

var _ fs.NodeRemover = (*FolderList)(nil)

// Remove implements the fs.NodeRemover interface for FolderList.
func (fl *FolderList) Remove(ctx context.Context, req *fuse.RemoveRequest) (err error) {
	fl.fs.vlog.CLogf(ctx, libkb.VLog1, "FolderList Remove %s", req.Name)
	defer func() { err = fl.fs.processError(ctx, libkbfs.WriteMode, err) }()

	h, err := tlfhandle.ParseHandlePreferredQuick(
		ctx, fl.fs.config.KBPKI(), fl.fs.config, req.Name, fl.tlfType)

	switch err := errors.Cause(err).(type) {
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

	case idutil.TlfNameNotCanonical:
		return nil

	case idutil.NoSuchNameError, idutil.BadTLFNameError,
		tlf.NoSuchUserError, idutil.NoSuchUserError:
		// Invalid TLF.
		return fuse.ENOENT

	default:
		return err
	}
}

var _ fs.NodeSymlinker = (*FolderList)(nil)

// Symlink implements the fs.NodeSymlinker interface for FolderList.
func (fl *FolderList) Symlink(
	_ context.Context, _ *fuse.SymlinkRequest) (fs.Node, error) {
	return nil, fuse.ENOTSUP
}

var _ fs.NodeLinker = (*FolderList)(nil)

// Link implements the fs.NodeLinker interface for FolderList.
func (fl *FolderList) Link(
	_ context.Context, _ *fuse.LinkRequest, _ fs.Node) (fs.Node, error) {
	return nil, fuse.ENOTSUP
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

		fl.fs.vlog.CLogf(
			ctx, libkb.VLog1, "Folder name updated: %s -> %s", oldName, newName)
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

// update things after user changed.
func (fl *FolderList) userChanged(ctx context.Context, _, newUser kbname.NormalizedUsername) {
	var fs []*Folder
	func() {
		fl.mu.Lock()
		defer fl.mu.Unlock()
		for _, tlf := range fl.folders {
			fs = append(fs, tlf.folder)
		}
	}()
	for _, f := range fs {
		f.TlfHandleChange(ctx, nil)
	}
	if newUser != kbname.NormalizedUsername("") {
		fl.fs.config.KBFSOps().ForceFastForward(ctx)
	}
}

func (fl *FolderList) openFileCount() (ret int64) {
	fl.mu.Lock()
	defer fl.mu.Unlock()
	for _, tlf := range fl.folders {
		ret += tlf.openFileCount()
	}
	return ret + int64(len(fl.folders))
}

// Forget kernel reference to this node.
func (fl *FolderList) Forget() {
	fl.fs.root.forgetFolderList(fl.tlfType)
}
