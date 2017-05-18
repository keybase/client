// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// Folder represents KBFS top-level folders
type Folder struct {
	fs   *FS
	list *FolderList

	handleMu       sync.RWMutex
	h              *libkbfs.TlfHandle
	hPreferredName libkbfs.PreferredTlfName

	folderBranchMu sync.Mutex
	folderBranch   libkbfs.FolderBranch

	// Protects the nodes map.
	mu sync.Mutex
	// Map KBFS nodes to FUSE nodes, to be able to handle multiple
	// lookups and incoming change notifications. A node is present
	// here if the kernel holds a reference to it.
	//
	// If we ever support hardlinks, this would need refcounts.
	//
	// Children must call folder.forgetChildLocked on receiving the
	// FUSE Forget request.
	nodes map[libkbfs.NodeID]dokan.File

	// Protects the updateChan.
	updateMu sync.Mutex
	// updateChan is non-nil when the user disables updates via the
	// file system.  Sending a struct{}{} on this channel will unpause
	// the updates.
	updateChan chan<- struct{}

	// noForget is turned on when the folder may not be forgotten
	// because it has attached special file state with it.
	noForget bool
}

func newFolder(fl *FolderList, h *libkbfs.TlfHandle,
	hPreferredName libkbfs.PreferredTlfName) *Folder {
	f := &Folder{
		fs:             fl.fs,
		list:           fl,
		h:              h,
		hPreferredName: hPreferredName,
		nodes:          map[libkbfs.NodeID]dokan.File{},
	}
	return f
}

func (f *Folder) name() libkbfs.CanonicalTlfName {
	f.handleMu.RLock()
	defer f.handleMu.RUnlock()
	return libkbfs.CanonicalTlfName(f.hPreferredName)
}

func (f *Folder) setFolderBranch(folderBranch libkbfs.FolderBranch) error {
	f.folderBranchMu.Lock()
	defer f.folderBranchMu.Unlock()

	// TODO unregister all at unmount
	err := f.list.fs.config.Notifier().RegisterForChanges(
		[]libkbfs.FolderBranch{folderBranch}, f)
	if err != nil {
		return err
	}
	f.folderBranch = folderBranch
	return nil
}

func (f *Folder) unsetFolderBranch(ctx context.Context) {
	f.folderBranchMu.Lock()
	defer f.folderBranchMu.Unlock()
	if f.folderBranch == (libkbfs.FolderBranch{}) {
		// Wasn't set.
		return
	}

	err := f.list.fs.config.Notifier().UnregisterFromChanges([]libkbfs.FolderBranch{f.folderBranch}, f)
	if err != nil {
		f.fs.log.Info("cannot unregister change notifier for folder %q: %v",
			f.name(), err)
	}
	f.folderBranch = libkbfs.FolderBranch{}
}

func (f *Folder) getFolderBranch() libkbfs.FolderBranch {
	f.folderBranchMu.Lock()
	defer f.folderBranchMu.Unlock()
	return f.folderBranch
}

// forgetNode forgets a formerly active child with basename name.
func (f *Folder) forgetNode(ctx context.Context, node libkbfs.Node) {
	f.mu.Lock()
	defer f.mu.Unlock()

	delete(f.nodes, node.GetID())
	if len(f.nodes) == 0 && !f.noForget {
		f.unsetFolderBranch(ctx)
		f.list.forgetFolder(string(f.name()))
	}
}

func (f *Folder) reportErr(ctx context.Context,
	mode libkbfs.ErrorModeType, err error) {
	if err == nil {
		f.fs.log.CDebugf(ctx, "Request complete")
		return
	}

	f.fs.config.Reporter().ReportErr(ctx, f.name(), f.list.tlfType, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	f.fs.log.CDebugf(ctx, err.Error())
}

func (f *Folder) lockedAddNode(node libkbfs.Node, val dokan.File) {
	f.mu.Lock()
	f.nodes[node.GetID()] = val
	f.mu.Unlock()
}

// LocalChange is called for changes originating within in this process.
func (f *Folder) LocalChange(ctx context.Context, node libkbfs.Node, write libkbfs.WriteRange) {
	f.fs.queueNotification(func() {})
}

// BatchChanges is called for changes originating anywhere, including
// other hosts.
func (f *Folder) BatchChanges(ctx context.Context, changes []libkbfs.NodeChange) {
	f.fs.queueNotification(func() {})
}

// TlfHandleChange is called when the name of a folder changes.
// Note that newHandle may be nil. Then the handle in the folder is used.
// This is used on e.g. logout/login.
func (f *Folder) TlfHandleChange(ctx context.Context,
	newHandle *libkbfs.TlfHandle) {
	f.fs.log.CDebugf(ctx, "TlfHandleChange called on %q",
		canonicalNameIfNotNil(newHandle))

	// Handle in the background because we shouldn't lock during
	// the notification
	f.fs.queueNotification(func() {
		session, err := libkbfs.GetCurrentSessionIfPossible(ctx, f.fs.config.KBPKI(), f.list.tlfType == tlf.Public)
		// Here we get an error, but there is little that can be done.
		// session will be empty in the error case in which case we will default to the
		// canonical format.
		if err != nil {
			f.fs.log.CDebugf(ctx,
				"tlfHandleChange: GetCurrentUserInfoIfPossible failed: %v", err)
		}
		oldName, newName := func() (libkbfs.PreferredTlfName, libkbfs.PreferredTlfName) {
			f.handleMu.Lock()
			defer f.handleMu.Unlock()
			oldName := f.hPreferredName
			if newHandle != nil {
				f.h = newHandle
			}
			f.hPreferredName = f.h.GetPreferredFormat(session.Name)
			return oldName, f.hPreferredName
		}()

		if oldName != newName {
			f.list.updateTlfName(ctx, string(oldName), string(newName))
		}
	})
}

func canonicalNameIfNotNil(h *libkbfs.TlfHandle) string {
	if h == nil {
		return "(nil)"
	}
	return string(h.GetCanonicalName())
}

func (f *Folder) resolve(ctx context.Context) (*libkbfs.TlfHandle, error) {
	// In case there were any unresolved assertions, try them again on
	// the first load.  Otherwise, since we haven't subscribed to
	// updates yet for this folder, we might have missed a name
	// change.
	handle, err := f.h.ResolveAgain(ctx, f.fs.config.KBPKI())
	if err != nil {
		return nil, err
	}
	eq, err := f.h.Equals(f.fs.config.Codec(), *handle)
	if err != nil {
		return nil, err
	}
	if !eq {
		// Make sure the name changes in the folder and the folder list
		f.TlfHandleChange(ctx, handle)
	}
	return handle, nil
}

// Dir represents KBFS subdirectories.
type Dir struct {
	FSO
}

func newDir(folder *Folder, node libkbfs.Node, name string, parent libkbfs.Node) *Dir {
	d := &Dir{FSO{
		name:   name,
		parent: parent,
		folder: folder,
		node:   node,
	}}
	d.refcount.Increase()
	return d
}

// GetFileInformation for dokan.
func (d *Dir) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (st *dokan.Stat, err error) {
	d.folder.fs.logEnter(ctx, "Dir GetFileInformation")
	defer func() { d.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	return eiToStat(d.folder.fs.config.KBFSOps().Stat(ctx, d.node))
}

// SetFileAttributes for Dokan.
func (d *Dir) SetFileAttributes(ctx context.Context, fi *dokan.FileInfo, fileAttributes dokan.FileAttribute) error {
	d.folder.fs.logEnter(ctx, "Dir SetFileAttributes")
	// TODO handle attributes for real.
	return nil
}

// isNoSuchNameError checks for libkbfs.NoSuchNameError.
func isNoSuchNameError(err error) bool {
	_, ok := err.(libkbfs.NoSuchNameError)
	return ok
}

// lastStr returns last string in a string slice or "" if the slice is empty.
func lastStr(strs []string) string {
	if len(strs) == 0 {
		return ""
	}
	return strs[len(strs)-1]
}

// open tries to open a file.
func (d *Dir) open(ctx context.Context, oc *openContext, path []string) (dokan.File, bool, error) {
	d.folder.fs.log.CDebugf(ctx, "Dir openDir %v", path)

	specialNode := handleTLFSpecialFile(lastStr(path), d.folder)
	if specialNode != nil {
		return oc.returnFileNoCleanup(specialNode)
	}

	origPath := path
	rootDir := d
	for len(path) > 0 {
		// Handle upper case filenames from junctions etc
		if c := lowerTranslateCandidate(oc, path[0]); c != "" {
			var hit string
			var nhits int
			d.FindFiles(ctx, nil, c, func(ns *dokan.NamedStat) error {
				if strings.ToLower(ns.Name) == c {
					hit = ns.Name
					nhits++
				}
				return nil
			})
			if nhits != 1 {
				return nil, false, dokan.ErrObjectNameNotFound
			}
			path[0] = hit
		}

		leaf := len(path) == 1

		// Check if this is a per-file metainformation file, if so
		// return the corresponding SpecialReadFile.
		if leaf && strings.HasPrefix(path[0], libfs.FileInfoPrefix) {
			if err := oc.ReturningFileAllowed(); err != nil {
				return nil, false, err
			}
			node, _, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, path[0][len(libfs.FileInfoPrefix):])
			if err != nil {
				return nil, false, err
			}
			nmd, err := d.folder.fs.config.KBFSOps().GetNodeMetadata(ctx, node)
			if err != nil {
				return nil, false, err
			}
			return &SpecialReadFile{read: fileInfo(nmd).read, fs: d.folder.fs}, false, nil
		}

		newNode, de, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, path[0])

		// If we are in the final component, check if it is a creation.
		if leaf {
			notFound := isNoSuchNameError(err)
			switch {
			case notFound && oc.isCreateDirectory():
				return d.mkdir(ctx, oc, path[0])
			case notFound && oc.isCreation():
				return d.create(ctx, oc, path[0])
			case !notFound && oc.isExistingError():
				return nil, false, dokan.ErrFileAlreadyExists
			}
		}

		// Return errors from Lookup
		if err != nil {
			return nil, false, err
		}

		if newNode != nil {
			d.folder.mu.Lock()
			f, _ := d.folder.nodes[newNode.GetID()]
			d.folder.mu.Unlock()
			// Symlinks don't have stored nodes, so they are impossible here.
			switch x := f.(type) {
			default:
				return nil, false, fmt.Errorf("unhandled node type: %T", f)
			case nil:
			case *File:
				if err := oc.ReturningFileAllowed(); err != nil {
					return nil, false, err
				}
				x.refcount.Increase()
				return openFile(ctx, oc, path, x)
			case *Dir:
				d = x
				path = path[1:]
				continue
			}
		}
		switch de.Type {
		default:
			return nil, false, fmt.Errorf("unhandled entry type: %v", de.Type)
		case libkbfs.File, libkbfs.Exec:
			if err := oc.ReturningFileAllowed(); err != nil {
				return nil, false, err
			}
			child := newFile(d.folder, newNode, path[0], d.node)
			f, _, err := openFile(ctx, oc, path, child)
			if err == nil {
				d.folder.lockedAddNode(newNode, child)
			}
			return f, false, err
		case libkbfs.Dir:
			child := newDir(d.folder, newNode, path[0], d.node)
			d.folder.lockedAddNode(newNode, child)
			d = child
			path = path[1:]
		case libkbfs.Sym:
			return openSymlink(ctx, oc, d, rootDir, origPath, path, de.SymPath)
		}
	}
	if err := oc.ReturningDirAllowed(); err != nil {
		return nil, false, err
	}
	d.refcount.Increase()
	return d, true, nil
}

type fileInfo libkbfs.NodeMetadata

func (fi fileInfo) read(ctx context.Context) ([]byte, time.Time, error) {
	bs, err := libfs.PrettyJSON(fi)
	return bs, time.Time{}, err
}

func openFile(ctx context.Context, oc *openContext, path []string, f *File) (dokan.File, bool, error) {
	var err error
	// Files only allowed as leafs...
	if len(path) > 1 {
		return nil, false, dokan.ErrObjectNameNotFound
	}
	if oc.isTruncate() {
		err = f.folder.fs.config.KBFSOps().Truncate(ctx, f.node, 0)
	}
	if err != nil {
		return nil, false, err
	}
	return f, false, nil
}

func openSymlink(ctx context.Context, oc *openContext, parent *Dir, rootDir *Dir, origPath, path []string, target string) (dokan.File, bool, error) {
	// TODO handle file/directory type flags here from CreateOptions.
	if !oc.reduceRedirectionsLeft() {
		return nil, false, dokan.ErrObjectNameNotFound
	}
	// Take relevant prefix of original path.
	origPath = origPath[:len(origPath)-len(path)]
	if len(path) == 1 && oc.isOpenReparsePoint() {
		// a Symlink is never included in Folder.nodes, as it doesn't
		// have a libkbfs.Node to keep track of renames.
		// Here we may get an error if the symlink destination does not exist.
		// which is fine, treat such non-existing targets as symlinks to a file.
		isDir, err := resolveSymlinkIsDir(ctx, oc, rootDir, origPath, target)
		parent.folder.fs.log.CDebugf(ctx, "openSymlink leaf returned %v,%v => %v,%v", origPath, target, isDir, err)
		return &Symlink{parent: parent, name: path[0], isTargetADirectory: isDir}, isDir, nil
	}
	// reference symlink, symbolic links always use '/' instead of '\'.
	if target == "" || target[0] == '/' {
		return nil, false, dokan.ErrNotSupported
	}

	dst, err := resolveSymlinkPath(ctx, origPath, target)
	parent.folder.fs.log.CDebugf(ctx, "openSymlink resolve returned %v,%v => %v,%v", origPath, target, dst, err)
	if err != nil {
		return nil, false, err
	}
	dst = append(dst, path[1:]...)
	return rootDir.open(ctx, oc, dst)
}

func getExclFromOpenContext(oc *openContext) libkbfs.Excl {
	return libkbfs.Excl(oc.CreateDisposition == dokan.FileCreate)
}

func (d *Dir) create(ctx context.Context, oc *openContext, name string) (f dokan.File, isDir bool, err error) {
	d.folder.fs.log.CDebugf(ctx, "Dir Create %s", name)
	defer func() { d.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	isExec := false // Windows lacks executable modes.
	excl := getExclFromOpenContext(oc)
	newNode, _, err := d.folder.fs.config.KBFSOps().CreateFile(
		ctx, d.node, name, isExec, excl)
	if err != nil {
		return nil, false, err
	}

	child := newFile(d.folder, newNode, name, d.node)
	d.folder.lockedAddNode(newNode, child)
	return child, false, nil
}

func (d *Dir) mkdir(ctx context.Context, oc *openContext, name string) (f *Dir, isDir bool, err error) {
	d.folder.fs.log.CDebugf(ctx, "Dir Mkdir %s", name)
	defer func() { d.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	newNode, _, err := d.folder.fs.config.KBFSOps().CreateDir(
		ctx, d.node, name)
	if err != nil {
		return nil, false, err
	}

	child := newDir(d.folder, newNode, name, d.node)
	d.folder.lockedAddNode(newNode, child)
	return child, true, nil
}

// FindFiles does readdir for dokan.
func (d *Dir) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) (err error) {
	d.folder.fs.logEnter(ctx, "Dir FindFiles")
	defer func() { d.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	children, err := d.folder.fs.config.KBFSOps().GetDirChildren(ctx, d.node)
	if err != nil {
		return err
	}

	empty := true
	var ns dokan.NamedStat
	for name, de := range children {
		empty = false
		ns.Name = name
		// TODO perhaps resolve symlinks here?
		fillStat(&ns.Stat, &de)
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

// CanDeleteDirectory - return just nil
// TODO check for permissions here.
func (d *Dir) CanDeleteDirectory(ctx context.Context, fi *dokan.FileInfo) (err error) {
	d.folder.fs.logEnterf(ctx, "Dir CanDeleteDirectory %q", d.name)
	defer func() { d.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	children, err := d.folder.fs.config.KBFSOps().GetDirChildren(ctx, d.node)
	if err != nil {
		return errToDokan(err)
	}
	if len(children) > 0 {
		return dokan.ErrDirectoryNotEmpty
	}

	return nil
}

// Cleanup - forget references, perform deletions etc.
// If Cleanup is called with non-nil FileInfo that has IsDeleteOnClose()
// no libdokan locks should be held prior to the call.
func (d *Dir) Cleanup(ctx context.Context, fi *dokan.FileInfo) {
	var err error
	if fi != nil {
		d.folder.fs.logEnterf(ctx, "Dir Cleanup %q delete=%v", d.name,
			fi.IsDeleteOnClose())
	} else {
		d.folder.fs.logEnterf(ctx, "Dir Cleanup %q", d.name)
	}
	defer func() { d.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	if fi != nil && fi.IsDeleteOnClose() && d.parent != nil {
		// renameAndDeletionLock should be the first lock to be grabbed in libdokan.
		d.folder.fs.renameAndDeletionLock.Lock()
		defer d.folder.fs.renameAndDeletionLock.Unlock()
		d.folder.fs.log.CDebugf(ctx, "Removing (Delete) dir in cleanup %s", d.name)

		err = d.folder.fs.config.KBFSOps().RemoveDir(ctx, d.parent, d.name)
	}

	if d.refcount.Decrease() {
		d.folder.forgetNode(ctx, d.node)
	}
}

func resolveSymlinkPath(ctx context.Context, origPath []string, targetPath string) ([]string, error) {
	pathComponents := make([]string, len(origPath), len(origPath)+1)
	copy(pathComponents, origPath)

	for _, p := range strings.FieldsFunc(targetPath, isPathSeparator) {
		switch p {
		case ".":
		case "..":
			if len(pathComponents) == 0 {
				return nil, dokan.ErrNotSupported
			}
			pathComponents = pathComponents[:len(pathComponents)-1]
		default:
			pathComponents = append(pathComponents, p)
		}
	}
	return pathComponents, nil
}

func resolveSymlinkIsDir(ctx context.Context, oc *openContext, rootDir *Dir, origPath []string, targetPath string) (bool, error) {
	dst, err := resolveSymlinkPath(ctx, origPath, targetPath)
	if err != nil {
		return false, err
	}
	obj, isDir, err := rootDir.open(ctx, oc, dst)
	if err == nil {
		obj.Cleanup(ctx, nil)
	}
	return isDir, err
}
func isPathSeparator(r rune) bool {
	return r == '/' || r == '\\'
}

func asDir(ctx context.Context, f dokan.File) *Dir {
	switch x := f.(type) {
	case *Dir:
		return x
	case *TLF:
		d, _, _ := x.loadDirHelper(ctx, "asDir", libkbfs.WriteMode, false)
		return d
	}
	return nil
}
