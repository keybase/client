// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"fmt"

	billy "gopkg.in/src-d/go-billy.v4"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
)

// repoFromStorageAndWorktree returns a repo instance where the dotgit
// storage layer points to the bare repo represented by `repoFS`, but
// the worktree storage layer uses `worktreeFS`.  This is useful for
// checking out the git repo without having to read and copy the
// complete git history.  The index and the HEAD commit of the
// worktree are stored in `worktreeFS/.git`.  The caller should make
// no modifying calls into the repo, other than checkout/reset-related
// calls.
//
// For the convenience of the caller, it also returns `repoHead`,
// which is the current commit at the HEAD of `branch`, according to
// the bare repo represented by `repoFS`.  In addition, it returns
// `worktreeHead`, which is the current commit that the worktree has or
// `plumbing.ZeroHash` if the worktree is uninitialized.
func repoFromStorageAndWorktree(
	repoFS billy.Filesystem, worktreeFS billy.Filesystem,
	branch plumbing.ReferenceName) (
	repo *gogit.Repository, repoHead, worktreeHead plumbing.Hash, err error) {
	repoStorer, err := filesystem.NewStorage(repoFS)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}

	// Wrap it in an on-demand storer, so we don't try to read all the
	// objects of big repos into memory at once.
	storage, err := NewOnDemandStorer(repoStorer)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}

	repoHeadRef, err := storer.ResolveReference(storage, branch)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}

	err = worktreeFS.MkdirAll(".git", 0600)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}
	wtDotgitFS, err := worktreeFS.Chroot(".git")
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}
	wtDotgit, err := filesystem.NewStorage(wtDotgitFS)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}
	worktreeHead = plumbing.ZeroHash
	worktreeHeadRef, err := storer.ResolveReference(wtDotgit, plumbing.HEAD)
	if err == nil {
		worktreeHead = worktreeHeadRef.Hash()
	}

	wtStorage := &worktreeStorer{storage, storage, wtDotgit}

	// Override the `IndexStorer` methods with an `IndexStorage` that
	// points to worktreeFS/.git.  And also also reroutes HEAD
	// reference management to worktreeFS/.git as well.
	repo, err = gogit.Open(wtStorage, worktreeFS)
	if err != nil {
		return nil, plumbing.ZeroHash, plumbing.ZeroHash, err
	}
	return repo, repoHeadRef.Hash(), worktreeHead, nil
}

// Reset checks out a repo from a billy filesystem, into another billy
// filesystem.  However, it doesn't make a true git clone, for two
// reasons.
//
// 1. This will be used to clone KBFS repos, and go-git doesn't
//    natively understand the keybase:// protocol.  There might be a
//    way around this with the `InstallProtocol` go-git method, but I
//    haven't investigated that yet and it would be some extra work.
//
// 2. These clones are intended for autogit, which will display them
//    as read-only directories.  They do not need to be real git
//    repos, and so there's no need to copy object files or much else
//    in the .git repo.  All we really need is an index, to compute
//    the differences.  Making a full git clone, or even a "shallow"
//    git clone, would be wasteful in that it would read and write way
//    more data than we really need.
//
// The resulting checkout in `worktreeFS` is therefore not a functional
// git repo.  The caller should only interact with `worktreeFS` in a
// read-only way, and should not attempt any git operations on it.
func Reset(
	ctx context.Context, repoFS billy.Filesystem, worktreeFS billy.Filesystem,
	branch plumbing.ReferenceName) error {
	repo, repoHead, worktreeHead, err := repoFromStorageAndWorktree(
		repoFS, worktreeFS, branch)
	if err != nil {
		return err
	}

	// Quickly check if the repo is already up-to-date.
	if worktreeHead == repoHead {
		return nil
	}

	wt, err := repo.Worktree()
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			// Clean up the worktree HEAD so the next update attempt
			// won't get optimized away.
			_ = worktreeFS.Remove(fmt.Sprintf(".git/%s", plumbing.HEAD))
		}
	}()

	return wt.Reset(&gogit.ResetOptions{
		Commit: repoHead,
		Mode:   gogit.HardReset,
	})
}
