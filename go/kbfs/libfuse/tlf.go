// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"os"
	"sync"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// TLF represents the root directory of a TLF. It wraps a lazy-loaded
// Dir.
type TLF struct {
	folder *Folder
	inode  uint64

	dirLock sync.RWMutex
	dir     *Dir

	// We never set quarantine on TLF roots, so don't bother with getting a dir
	// and calling the method on it. Instead, just use this dumb handler to
	// always return fuse.ENOTSUP.
	NoXattrHandler
}

func newTLF(ctx context.Context, fl *FolderList, h *tlfhandle.Handle,
	name tlf.PreferredName) *TLF {
	folder := newFolder(ctx, fl, h, name)
	tlf := &TLF{
		folder: folder,
		inode:  fl.fs.assignInode(),
	}
	return tlf
}

var _ DirInterface = (*TLF)(nil)

func (tlf *TLF) getStoredDir() *Dir {
	tlf.dirLock.RLock()
	defer tlf.dirLock.RUnlock()
	return tlf.dir
}

func (tlf *TLF) clearStoredDir() {
	tlf.dirLock.Lock()
	defer tlf.dirLock.Unlock()
	tlf.dir = nil
}

func (tlf *TLF) log() logger.Logger {
	return tlf.folder.fs.log
}

func (tlf *TLF) vlog() *libkb.VDebugLog {
	return tlf.folder.fs.vlog
}

func (tlf *TLF) loadDirHelper(
	ctx context.Context, mode libkbfs.ErrorModeType, branch data.BranchName,
	filterErr bool) (dir *Dir, exitEarly bool, err error) {
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

	tlf.log().CDebugf(ctx, "Loading root directory for folder %s "+
		"(type: %s, filter error: %t)", tlf.folder.name(),
		tlf.folder.list.tlfType, filterErr)
	defer func() {
		if filterErr {
			exitEarly, err = libfs.FilterTLFEarlyExitError(ctx, err, tlf.log(), tlf.folder.name())
		}
		err = tlf.folder.processError(ctx, mode, err)
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
	tlf.dir = newDirWithInode(tlf.folder, rootNode, tlf.inode)

	return tlf.dir, false, nil
}

func (tlf *TLF) loadDir(ctx context.Context) (*Dir, error) {
	dir, _, err := tlf.loadDirHelper(
		ctx, libkbfs.WriteMode, data.MasterBranch, false)
	return dir, err
}

// loadDirAllowNonexistent loads a TLF if it's not already loaded.  If
// the TLF doesn't yet exist, it still returns a nil error and
// indicates that the calling function should pretend it's an empty
// folder.
func (tlf *TLF) loadDirAllowNonexistent(ctx context.Context) (
	*Dir, bool, error) {
	return tlf.loadDirHelper(ctx, libkbfs.ReadMode, data.MasterBranch, true)
}

func (tlf *TLF) loadArchivedDir(
	ctx context.Context, branch data.BranchName) (*Dir, bool, error) {
	// Always filter errors for archive TLF directories, so that we
	// don't try to initialize them.
	return tlf.loadDirHelper(ctx, libkbfs.ReadMode, branch, true)
}

// Access implements the fs.NodeAccesser interface for *TLF.
func (tlf *TLF) Access(ctx context.Context, r *fuse.AccessRequest) error {
	return tlf.folder.access(ctx, r)
}

// Attr implements the fs.Node interface for TLF.
func (tlf *TLF) Attr(ctx context.Context, a *fuse.Attr) error {
	dir := tlf.getStoredDir()
	a.Inode = tlf.inode
	if dir == nil {
		tlf.vlog().CLogf(
			ctx, libkb.VLog1, "Faking Attr for TLF %s", tlf.folder.name())
		// Have a low non-zero value for Valid to avoid being
		// swamped with requests, while still not showing
		// stale data for too long if we end up loading the
		// dir.
		a.Valid = 1 * time.Second
		a.Mode = os.ModeDir | 0500
		a.Uid = uint32(os.Getuid())
		return nil
	}

	return dir.Attr(ctx, a)
}

// tlfLoadAvoidingLookupNames specifies a set of directory entry names
// that should NOT cause a TLF to be fully loaded and identified on a
// lookup.  If the directory is not yet loaded and one of these names
// are looked-up, then ENOENT will be returned automatically.  This is
// to avoid unnecessary loading and tracker popups when listing the
// folder list directories.  For example, when macOS finder opens
// `/keybase/private`, it looks up `.localized` in every TLF
// subdirectory to see if it should translate the TLF folder name or
// not, which can cause a tracker popup storm (see KBFS-2649).
var tlfLoadAvoidingLookupNames = map[string]bool{
	".localized": true,
	"Contents":   true,
}

// Lookup implements the fs.NodeRequestLookuper interface for TLF.
func (tlf *TLF) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	if tlfLoadAvoidingLookupNames[req.Name] {
		dir := tlf.getStoredDir()
		if dir == nil {
			tlf.vlog().CLogf(
				ctx, libkb.VLog1, "Avoiding TLF loading for name %s", req.Name)
			return nil, fuse.ENOENT
		}
		return dir.Lookup(ctx, req, resp)
	}

	dir, exitEarly, err := tlf.loadDirAllowNonexistent(ctx)
	if err != nil {
		return nil, err
	}
	if exitEarly {
		if node := handleTLFSpecialFile(
			req.Name, tlf.folder, &resp.EntryValid); node != nil {
			return node, nil
		}
		return nil, fuse.ENOENT
	}

	branch, isArchivedBranch := libfs.BranchNameFromArchiveRefDir(req.Name)
	if isArchivedBranch {
		archivedTLF := newTLF(ctx,
			tlf.folder.list, tlf.folder.h, tlf.folder.hPreferredName)
		_, _, err := archivedTLF.loadArchivedDir(ctx, branch)
		if err != nil {
			return nil, err
		}
		return archivedTLF, nil
	}

	linkTarget, isArchivedTimeLink, err := libfs.LinkTargetFromTimeString(
		ctx, tlf.folder.fs.config, tlf.folder.h, req.Name)
	if err != nil {
		return nil, err
	}
	if isArchivedTimeLink {
		return &Alias{
			realPath: linkTarget,
			inode:    0,
		}, nil
	}

	_, isRelTimeLink, err := libfs.FileDataFromRelativeTimeString(
		ctx, tlf.folder.fs.config, tlf.folder.h, req.Name)
	if err != nil {
		return nil, err
	}
	if isRelTimeLink {
		return NewArchiveRelTimeFile(
			tlf.folder.fs, tlf.folder.h, req.Name, &resp.EntryValid), nil
	}

	return dir.Lookup(ctx, req, resp)
}

// Create implements the fs.NodeCreater interface for TLF.
func (tlf *TLF) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (fs.Node, fs.Handle, error) {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return nil, nil, err
	}
	return dir.Create(ctx, req, resp)
}

// Mkdir implements the fs.NodeMkdirer interface for TLF.
func (tlf *TLF) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (_ fs.Node, err error) {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return nil, err
	}
	return dir.Mkdir(ctx, req)
}

// Symlink implements the fs.NodeSymlinker interface for TLF.
func (tlf *TLF) Symlink(ctx context.Context, req *fuse.SymlinkRequest) (
	fs.Node, error) {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return nil, err
	}
	return dir.Symlink(ctx, req)
}

var _ fs.NodeLinker = (*TLF)(nil)

// Link implements the fs.NodeLinker interface for TLF.
func (tlf *TLF) Link(
	_ context.Context, _ *fuse.LinkRequest, _ fs.Node) (fs.Node, error) {
	return nil, fuse.ENOTSUP
}

// Rename implements the fs.NodeRenamer interface for TLF.
func (tlf *TLF) Rename(ctx context.Context, req *fuse.RenameRequest,
	newDir fs.Node) error {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return err
	}
	return dir.Rename(ctx, req, newDir)
}

// Remove implements the fs.NodeRemover interface for TLF.
func (tlf *TLF) Remove(ctx context.Context, req *fuse.RemoveRequest) error {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return err
	}
	return dir.Remove(ctx, req)
}

// ReadDirAll implements the fs.NodeReadDirAller interface for TLF.
func (tlf *TLF) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	dir, exitEarly, err := tlf.loadDirAllowNonexistent(ctx)
	if err != nil || exitEarly {
		return nil, err
	}
	return dir.ReadDirAll(ctx)
}

// Forget kernel reference to this node.
func (tlf *TLF) Forget() {
	dir := tlf.getStoredDir()
	if dir != nil {
		dir.Forget()
	} else {
		tlf.folder.list.forgetFolder(string(tlf.folder.name()))
	}
}

// Setattr implements the fs.NodeSetattrer interface for TLF.
func (tlf *TLF) Setattr(ctx context.Context, req *fuse.SetattrRequest, resp *fuse.SetattrResponse) error {
	dir, err := tlf.loadDir(ctx)
	if err != nil {
		return err
	}
	return dir.Setattr(ctx, req, resp)
}

// Fsync implements the fs.NodeFsyncer interface for TLF.
func (tlf *TLF) Fsync(ctx context.Context, req *fuse.FsyncRequest) (err error) {
	dir := tlf.getStoredDir()
	if dir == nil {
		// The directory hasn't been loaded yet, so there's nothing to do.
		return nil
	}

	return dir.Fsync(ctx, req)
}

var _ fs.Handle = (*TLF)(nil)

var _ fs.NodeOpener = (*TLF)(nil)

// Open implements the fs.NodeOpener interface for TLF.
func (tlf *TLF) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	// Explicitly load the directory when a TLF is opened, because
	// some OSX programs like ls have a bug that doesn't report errors
	// on a ReadDirAll.
	_, _, err := tlf.loadDirAllowNonexistent(ctx)
	if err != nil {
		return nil, err
	}
	return tlf, nil
}

func (tlf *TLF) openFileCount() int64 {
	return tlf.folder.openFileCount()
}
