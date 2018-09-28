// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"path"
	"strings"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
)

// This file contains libkbfs.Node wrappers for implementing the
// .kbfs_autogit directory structure. It breaks down like this:
//
// * `rootWrapper.wrap()` is installed as a root node wrapper, and wraps
//   the root node for each TLF in a `rootNode` instance.
// * `rootNode` allows .kbfs_autogit to be auto-created when it is
//   looked up, and wraps it two ways, as both a `libkbfs.ReadonlyNode`, and
//   an `autogitRootNode`.
// * `autogitRootNode` lists all the git repos associated with this
//   folder-branch.  It wraps child nodes two ways, as both a
//   `libkbfs.ReadonlyNode` (inherited from `rootNode`), and an
//   `repoDirNode`.
// * `repoDirNode` returns a `*Browser` object when `GetFS()` is
//   called, which is configured to access the corresponding
//   subdirectory within the git repository.  It makes a new
//   `*Browser` instance for each `GetFS()` call, which is slightly
//   inefficient, but necessary to put the right context debug log
//   tags into place for the subsequent browsing.  (We can revisit
//   this later if it proves to be a bottleneck, though I suspect the
//   bottleneck is in fetching and processing the actual git data
//   needed to reconstruct the files.)  It wraps all children as a
//   `libkbfs.ReadonlyNode` (inherited from `rootNode`); it also wraps
//   subdirectories in `repoDirNode`, and file entries in
//   `repoFileNode`.
// * `repoFileNode` returns a `*browserFile` object when `GetFile()`
//   is called, which is expected to be closed by the caller.  It
//   constructs a new `*Browser` on each call (for the same reasons as
//   above).

const (
	// AutogitRoot is the subdirectory name within a TLF where autogit
	// can be accessed.
	AutogitRoot = ".kbfs_autogit"
	// AutogitBranchPrefix is a prefix of a subdirectory name
	// containing one element of a git reference name.
	AutogitBranchPrefix = ".kbfs_autogit_branch_"
	// branchSlash can substitute for slashes in branch names,
	// following `AutogitBranchPrefix`.
	branchSlash = ":"
)

type repoFileNode struct {
	libkbfs.Node
	am       *AutogitManager
	repoFS   *libfs.FS
	filePath string
	branch   plumbing.ReferenceName
}

var _ libkbfs.Node = (*repoFileNode)(nil)

func (rfn repoFileNode) GetFile(ctx context.Context) billy.File {
	// Make a new Browser for every request, for the sole purpose of
	// using the appropriate debug tags.
	repoFS := rfn.repoFS.WithContext(ctx)
	b, err := NewBrowser(repoFS, rfn.am.config.Clock(), rfn.branch)
	if err != nil {
		rfn.am.log.CDebugf(ctx, "Error making browser: %+v", err)
		return nil
	}
	f, err := b.Open(rfn.filePath)
	if err != nil {
		rfn.am.log.CDebugf(ctx, "Error opening file: %+v", err)
		return nil
	}
	return f
}

type repoDirNode struct {
	libkbfs.Node
	am     *AutogitManager
	repoFS *libfs.FS
	subdir string
	branch plumbing.ReferenceName
}

var _ libkbfs.Node = (*repoDirNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// repoDirNode.
func (rdn *repoDirNode) ShouldCreateMissedLookup(
	ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	if !strings.HasPrefix(name, AutogitBranchPrefix) {
		return rdn.Node.ShouldCreateMissedLookup(ctx, name)
	}

	branchName := strings.TrimPrefix(name, AutogitBranchPrefix)
	if len(branchName) == 0 {
		return rdn.Node.ShouldCreateMissedLookup(ctx, name)
	}

	// It's difficult to tell if a given name is a legitimate prefix
	// to a branch name or not, so just accept everything.  If it's
	// not legit, trying to read the data will error out.
	return true, ctx, libkbfs.FakeDir, ""
}

func (rdn repoDirNode) GetFS(ctx context.Context) billy.Filesystem {
	// Make a new Browser for every request, for the sole purpose of
	// using the appropriate debug tags.
	repoFS := rdn.repoFS.WithContext(ctx)
	b, err := NewBrowser(repoFS, rdn.am.config.Clock(), rdn.branch)
	if err != nil {
		rdn.am.log.CDebugf(ctx, "Error making browser: %+v", err)
		return nil
	}
	if rdn.subdir == "" || rdn.subdir == "." {
		return b
	}

	childB, err := b.Chroot(rdn.subdir)
	if err != nil {
		rdn.am.log.CDebugf(ctx, "Error chroot'ing browser: %+v", err)
		return nil
	}
	return childB
}

func (rdn repoDirNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = rdn.Node.WrapChild(child)
	name := child.GetBasename()

	if rdn.subdir == "" && strings.HasPrefix(name, AutogitBranchPrefix) {
		branchName := strings.TrimPrefix(name, AutogitBranchPrefix)
		return &repoDirNode{
			Node:   child,
			am:     rdn.am,
			repoFS: rdn.repoFS,
			subdir: "",
			branch: plumbing.ReferenceName(path.Join(
				string(rdn.branch),
				strings.Replace(branchName, branchSlash, "/", -1))),
		}
	}

	// Wrap this child so that it will show all the
	// repos. TODO(KBFS-3429): fill in context.
	ctx := context.TODO()
	fs := rdn.GetFS(ctx)
	fi, err := fs.Lstat(name)
	if err != nil {
		rdn.am.log.CDebugf(nil, "Error getting type of child: %+v", err)
		return child
	}
	if fi.IsDir() {
		return &repoDirNode{
			Node:   child,
			am:     rdn.am,
			repoFS: rdn.repoFS,
			subdir: path.Join(rdn.subdir, name),
			branch: rdn.branch,
		}
	}
	return &repoFileNode{
		Node:     child,
		am:       rdn.am,
		repoFS:   rdn.repoFS,
		filePath: path.Join(rdn.subdir, name),
		branch:   rdn.branch,
	}
}

// autogitRootNode represents the .kbfs_autogit folder, and lists all
// the git repos associated with the member Node's TLF.
type autogitRootNode struct {
	libkbfs.Node
	am *AutogitManager
	fs *libfs.FS
}

var _ libkbfs.Node = (*autogitRootNode)(nil)

func (arn autogitRootNode) GetFS(ctx context.Context) billy.Filesystem {
	arn.am.log.CDebugf(ctx, "autogit root node GetFS() called")
	return arn.fs.WithContext(ctx)
}

// WrapChild implements the Node interface for autogitRootNode.
func (arn autogitRootNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = arn.Node.WrapChild(child)
	repoFS, err := arn.fs.Chroot(child.GetBasename())
	if err != nil {
		arn.am.log.CDebugf(nil, "Error getting repo: %+v", err)
		return child
	}
	rdn := &repoDirNode{
		Node:   child,
		am:     arn.am,
		repoFS: repoFS.(*libfs.FS),
		subdir: "",
		branch: "",
	}
	if fs, ok := repoFS.(*libfs.FS); ok {
		arn.am.registerRepoNode(fs.RootNode(), rdn)
	}
	return rdn
}

// rootNode is a Node wrapper around a TLF root node, that causes the
// autogit root to be created when it is accessed.
type rootNode struct {
	libkbfs.Node
	am *AutogitManager

	lock sync.RWMutex
	fs   *libfs.FS
}

var _ libkbfs.Node = (*rootNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// rootNode.
func (rn *rootNode) ShouldCreateMissedLookup(ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	if name != AutogitRoot {
		return rn.Node.ShouldCreateMissedLookup(ctx, name)
	}

	rn.lock.Lock()
	defer rn.lock.Unlock()
	if rn.fs == nil {
		// Make the FS once, in a place where we know the NodeCache
		// won't be locked (to avoid deadlock).

		h, err := rn.am.config.KBFSOps().GetTLFHandle(ctx, rn)
		if err != nil {
			rn.am.log.CDebugf(nil, "Error getting handle: %+v", err)
			return rn.Node.ShouldCreateMissedLookup(ctx, name)
		}

		// Wrap this child so that it will show all the
		// repos. TODO(KBFS-3429): fill in context.
		ctx := context.TODO()
		fs, err := libfs.NewFS(
			ctx, rn.am.config, h, rn.GetFolderBranch().Branch, kbfsRepoDir, "",
			keybase1.MDPriorityNormal)
		if err != nil {
			rn.am.log.CDebugf(nil, "Error making repo FS: %+v", err)
			return rn.Node.ShouldCreateMissedLookup(ctx, name)
		}
		rn.fs = fs
	}
	return true, ctx, libkbfs.FakeDir, ""
}

// WrapChild implements the Node interface for rootNode.
func (rn *rootNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = rn.Node.WrapChild(child)
	if child.GetBasename() != AutogitRoot {
		return child
	}

	rn.lock.RLock()
	defer rn.lock.RUnlock()
	if rn.fs == nil {
		rn.am.log.CDebugf(nil, "FS not available on WrapChild")
		return child
	}

	rn.am.log.CDebugf(nil, "Making autogit root node")
	return &autogitRootNode{
		Node: &libkbfs.ReadonlyNode{Node: child},
		am:   rn.am,
		fs:   rn.fs,
	}
}

// rootWrapper is a struct that manages wrapping root nodes with
// autogit-related context.
type rootWrapper struct {
	am *AutogitManager
}

func (rw rootWrapper) wrap(node libkbfs.Node) libkbfs.Node {
	return &rootNode{
		Node: node,
		am:   rw.am,
	}
}
