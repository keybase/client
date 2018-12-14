// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"os"
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
//   subdirectory within the git repository.  It wraps all children as
//   a `libkbfs.ReadonlyNode` (inherited from `rootNode`); it also
//   wraps subdirectories in `repoDirNode`, and file entries in
//   `repoFileNode`.
// * `repoFileNode` returns a `*browserFile` object when `GetFile()`
//   is called, which is expected to be closed by the caller.
//
// The `*Browser` objects returned are cached in the AutogitManager
// instance, in an LRU-cache, and are cleared whenever the underlying
// repo is updated.  However, this means that the log debug tags that
// are in use may be from the original request that caused the
// `*Browser` to be cached, rather than from the request that is using
// the cached browser.  If this becomes a problem when trying to debug
// stuff, we can modify the go-git `Tree` code to be able to replace
// the underlying storage layer with one that uses the right context.

const (
	// AutogitRoot is the subdirectory name within a TLF where autogit
	// can be accessed.
	AutogitRoot = ".kbfs_autogit"
	// AutogitBranchPrefix is a prefix of a subdirectory name
	// containing one element of a git reference name.
	AutogitBranchPrefix = ".kbfs_autogit_branch_"
	// branchSlash can substitute for slashes in branch names,
	// following `AutogitBranchPrefix`.
	branchSlash = "^"
)

type repoFileNode struct {
	libkbfs.Node
	am        *AutogitManager
	gitRootFS *libfs.FS
	repo      string
	subdir    string
	branch    plumbing.ReferenceName
	filePath  string
}

var _ libkbfs.Node = (*repoFileNode)(nil)

func (rfn repoFileNode) GetFile(ctx context.Context) billy.File {
	ctx = libkbfs.CtxWithRandomIDReplayable(
		ctx, ctxAutogitIDKey, ctxAutogitOpID, rfn.am.log)
	_, b, err := rfn.am.GetBrowserForRepo(
		ctx, rfn.gitRootFS, rfn.repo, rfn.branch, rfn.subdir)
	if err != nil {
		rfn.am.log.CDebugf(nil, "Error getting browser: %+v", err)
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
	am        *AutogitManager
	gitRootFS *libfs.FS
	repo      string
	subdir    string
	branch    plumbing.ReferenceName
	once      sync.Once
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

func (rdn *repoDirNode) GetFS(ctx context.Context) billy.Filesystem {
	ctx = libkbfs.CtxWithRandomIDReplayable(
		ctx, ctxAutogitIDKey, ctxAutogitOpID, rdn.am.log)
	_, b, err := rdn.am.GetBrowserForRepo(
		ctx, rdn.gitRootFS, rdn.repo, rdn.branch, rdn.subdir)
	if err != nil {
		rdn.am.log.CDebugf(ctx, "Error getting browser: %+v", err)
		return nil
	}

	if rdn.subdir == "" && rdn.branch == "" {
		// If this is the root node for the repo, register it exactly once.
		rdn.once.Do(func() {
			billyFS, err := rdn.gitRootFS.Chroot(rdn.repo)
			if err != nil {
				rdn.am.log.CDebugf(nil, "Error getting repo FS: %+v", err)
				return
			}
			repoFS := billyFS.(*libfs.FS)
			rdn.am.registerRepoNode(repoFS.RootNode(), rdn)
		})
	}

	return b
}

func (rdn *repoDirNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = rdn.Node.WrapChild(child)
	name := child.GetBasename()

	if rdn.subdir == "" && strings.HasPrefix(name, AutogitBranchPrefix) &&
		rdn.gitRootFS != nil {
		newBranchPart := strings.TrimPrefix(name, AutogitBranchPrefix)
		branch := plumbing.ReferenceName(path.Join(
			string(rdn.branch),
			strings.Replace(newBranchPart, branchSlash, "/", -1)))

		return &repoDirNode{
			Node:      child,
			am:        rdn.am,
			gitRootFS: rdn.gitRootFS,
			repo:      rdn.repo,
			subdir:    "",
			branch:    branch,
		}
	}

	if child.EntryType() == libkbfs.Dir {
		return &repoDirNode{
			Node:      child,
			am:        rdn.am,
			gitRootFS: rdn.gitRootFS,
			repo:      rdn.repo,
			subdir:    path.Join(rdn.subdir, name),
			branch:    rdn.branch,
		}
	}
	return &repoFileNode{
		Node:      child,
		am:        rdn.am,
		gitRootFS: rdn.gitRootFS,
		repo:      rdn.repo,
		subdir:    rdn.subdir,
		branch:    rdn.branch,
		filePath:  name,
	}
}

type wrappedRepoList struct {
	*libfs.FS
}

func (wrl *wrappedRepoList) Stat(repoName string) (os.FileInfo, error) {
	return wrl.FS.Stat(normalizeRepoName(repoName))
}

func (wrl *wrappedRepoList) Lstat(repoName string) (os.FileInfo, error) {
	return wrl.FS.Lstat(normalizeRepoName(repoName))
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
	ctx = libkbfs.CtxWithRandomIDReplayable(
		context.Background(), ctxAutogitIDKey, ctxAutogitOpID, arn.am.log)
	return &wrappedRepoList{arn.fs.WithContext(ctx)}
}

// WrapChild implements the Node interface for autogitRootNode.
func (arn autogitRootNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = arn.Node.WrapChild(child)
	repo := normalizeRepoName(child.GetBasename())
	return &repoDirNode{
		Node:      child,
		am:        arn.am,
		gitRootFS: arn.fs,
		repo:      repo,
		subdir:    "",
		branch:    "",
	}
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
			rn.am.log.CDebugf(ctx, "Error getting handle: %+v", err)
			return rn.Node.ShouldCreateMissedLookup(ctx, name)
		}

		// Wrap this child so that it will show all the repos.
		ctx := libkbfs.CtxWithRandomIDReplayable(
			context.Background(), ctxAutogitIDKey, ctxAutogitOpID, rn.am.log)
		fs, err := libfs.NewReadonlyFS(
			ctx, rn.am.config, h, rn.GetFolderBranch().Branch, kbfsRepoDir, "",
			keybase1.MDPriorityNormal)
		if err != nil {
			rn.am.log.CDebugf(ctx, "Error making repo FS: %+v", err)
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
