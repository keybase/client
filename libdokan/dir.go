// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"fmt"
	"strings"
	"sync"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// Folder represents KBFS top-level folders
type Folder struct {
	fs           *FS
	list         *FolderList
	name         string
	folderBranch libkbfs.FolderBranch

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
}

// forgetNode forgets a formerly active child with basename name.
func (f *Folder) forgetNode(node libkbfs.Node) {
	f.mu.Lock()
	defer f.mu.Unlock()

	delete(f.nodes, node.GetID())
	if len(f.nodes) == 0 {
		f.list.forgetFolder(f)
	}
}

func (f *Folder) lockedAddNode(node libkbfs.Node, val dokan.File) {
	f.mu.Lock()
	f.nodes[node.GetID()] = val
	f.mu.Unlock()
}

// LocalChange is called for changes originating within in this process.
func (f *Folder) LocalChange(ctx context.Context, node libkbfs.Node, write libkbfs.WriteRange) {
	return
}

// BatchChanges is called for changes originating anywhere, including
// other hosts.
func (f *Folder) BatchChanges(ctx context.Context, changes []libkbfs.NodeChange) {
	return
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
	return d
}

// GetFileInformation for dokan.
func (d *Dir) GetFileInformation(*dokan.FileInfo) (a *dokan.Stat, err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, d.folder.fs.log)
	d.folder.fs.log.CDebugf(ctx, "Dir Attr")
	defer func() { d.folder.fs.reportErr(ctx, err) }()

	return deToStat(d.folder.fs.config.KBFSOps().Stat(ctx, d.node))
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

// open tries to open a file. This handles special files and defaults to openDir for the common case.
func (d *Dir) open(fi *dokan.FileInfo, path []string, caf *createData) (dokan.File, bool, error) {
	// Error and metrics file already handled in fs.go.
	switch lastStr(path) {

	case StatusFileName:
		return NewStatusFile(d.folder), false, nil

	case UnstageFileName:
		child := &UnstageFile{
			folder: d.folder,
		}
		return child, false, nil

	case DisableUpdatesFileName:
		child := &UpdatesFile{
			folder: d.folder,
		}
		return child, false, nil

	case EnableUpdatesFileName:
		child := &UpdatesFile{
			folder: d.folder,
			enable: true,
		}
		return child, false, nil

	case RekeyFileName:
		child := &RekeyFile{
			folder: d.folder,
		}
		return child, false, nil
	}

	return openDir(d, fi, path, caf)
}

// openDir is the complex path lookup procedure.
func openDir(d *Dir, fi *dokan.FileInfo, path []string, caf *createData) (dokan.File, bool, error) {
	ctx := context.TODO()
	maxRedirections := 30

	for len(path) > 0 {
		leaf := len(path) == 1
		newNode, de, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, path[0])

		// If we are in the final component, check if it is a creation.
		if leaf {
			notFound := isNoSuchNameError(err)
			switch {
			case notFound && caf.isCreateDirectory():
				return d.mkdir(fi, path[0])
			case notFound && caf.isCreation():
				return d.create(fi, path[0], caf)
			case !notFound && caf.isExistingError():
				return nil, false, dokan.ErrFileAlreadyExists
			}
		}

		// Return errors from Lookup
		if err != nil {
			return nil, false, errToDokan(err)
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
				return openFile(ctx, path, caf, x)
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
			child := newFile(d.folder, newNode, path[0], d.node)
			f, _, err := openFile(ctx, path, caf, child)
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
			maxRedirections--
			if maxRedirections < 0 {
				return nil, false, dokan.ErrObjectPathNotFound
			}
			if leaf && caf.isOpenReparsePoint() {
				// a Symlink is never included in Folder.nodes, as it doesn't
				// have a libkbfs.Node to keep track of renames.
				return &Symlink{parent: d, name: path[0]}, false, nil
			}
			// reference symlink, symbolic links always use '/' instead of '\'.
			// also only support symlinks inside this directory for now.
			if de.SymPath == "" || de.SymPath[0] == '/' || strings.ContainsAny(de.SymPath, `/\`) {
				return nil, false, dokan.ErrNotSupported
			}
			path[0] = de.SymPath
		}
	}
	return d, true, nil
}

func openFile(ctx context.Context, path []string, caf *createData, f *File) (dokan.File, bool, error) {
	var err error
	// Files only allowed as leafs...
	if len(path) > 1 {
		return nil, false, dokan.ErrObjectPathNotFound
	}
	if caf.isTruncate() {
		err = f.folder.fs.config.KBFSOps().Truncate(ctx, f.node, 0)
	}
	if err != nil {
		return nil, false, err
	}
	return f, false, nil
}

func (d *Dir) create(fi *dokan.FileInfo, name string, caf *createData) (f dokan.File, isDir bool, err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, d.folder.fs.log)
	d.folder.fs.log.CDebugf(ctx, "Dir Create %s %v", name, caf)
	defer func() { d.folder.fs.reportErr(ctx, err) }()

	isExec := false // Windows lacks executable modes.
	newNode, _, err := d.folder.fs.config.KBFSOps().CreateFile(
		ctx, d.node, name, isExec)
	if err != nil {
		return nil, false, err
	}

	child := newFile(d.folder, newNode, name, d.node)
	d.folder.lockedAddNode(newNode, child)
	return child, false, nil
}

func (d *Dir) mkdir(fi *dokan.FileInfo, name string) (f *Dir, isDir bool, err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, d.folder.fs.log)
	d.folder.fs.log.CDebugf(ctx, "Dir Mkdir %s", name)
	defer func() { d.folder.fs.reportErr(ctx, err) }()

	newNode, _, err := d.folder.fs.config.KBFSOps().CreateDir(
		ctx, d.node, name)
	if err != nil {
		return nil, false, err
	}

	child := newDir(d.folder, newNode, name, d.node)
	d.folder.mu.Lock()
	d.folder.nodes[newNode.GetID()] = child
	d.folder.mu.Unlock()
	return child, true, nil
}

// FindFiles does readdir for dokan.
func (d *Dir) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, d.folder.fs.log)
	d.folder.fs.log.CDebugf(ctx, "Dir ReadDirAll")
	defer func() { d.folder.fs.reportErr(ctx, err) }()

	children, err := d.folder.fs.config.KBFSOps().GetDirChildren(ctx, d.node)
	if err != nil {
		return err
	}

	var ns dokan.NamedStat
	ns.NumberOfLinks = 1
	for name, et := range children {
		ns.Name = name
		switch et {
		case libkbfs.File, libkbfs.Exec:
			// FIXME kbfs does not provide file sizes here, windows kind of would like
			// them. Either return 0 for size here or stat each file (expensive...).
			ns.FileAttributes = fileAttributeNormal
			if !d.folder.fs.omitFindFilesStat {
				_, de, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, name)
				if err == nil {
					ns.FileSize = int64(de.Size)
				}
			}
		case libkbfs.Dir:
			ns.FileAttributes = fileAttributeDirectory
		case libkbfs.Sym:
			ns.FileAttributes = fileAttributeReparsePoint
			ns.ReparsePointTag = reparsePointTagSymlink
		}
		err = callback(&ns)
		if err != nil {
			return err
		}
	}
	return nil

}

// Cleanup - forget references, perform deletions etc.
func (d *Dir) Cleanup(fi *dokan.FileInfo) {
	var err error
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, d.folder.fs.log)

	if fi.DeleteOnClose() && d.parent != nil {
		d.folder.fs.log.CDebugf(ctx, "Removing dir in cleanup %s", d.name)
		defer func() { d.folder.fs.reportErr(ctx, err) }()

		err = d.folder.fs.config.KBFSOps().RemoveDir(ctx, d.parent, d.name)
	}

	d.folder.forgetNode(d.node)
}
