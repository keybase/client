// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"github.com/pkg/errors"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/format/index"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
)

// worktreeStorer fakes out the storage layer in such a way that it
// stores its index, and any reference modifications, in a .git/
// directory in the worktree, but everything else goes through the
// main repo's .git directory.  This is useful for making a quick
// checkout of a git repo in a new directory, without making a full
// git clone. For example, consider the following instance:
//
// * `storage.Storer` points to a bare repo stored in KBFS, say
//   `/keybase/team/keybase/.kbfs_git/secrets/`.
// * `delta` is the same as above, but cast as a `DeltaObjectStorer`.
// * `wtDotgit` can be pointed anywhere else in KBFS where you want to
//   track a checked-out version of the keybase secrets repo, say
//   `/keybase/private/strib/.kbfs_autogit/team/keybase/secrets/.git/`
//
// Any calls to update the index or set a reference will be routed to
// `wtDotgit`, and everything else goes to `storage.Storer`.  That
// means that the caller can use this to "reset" the autogit worktree
// to some commit stored in the main bare repo, without having to do a
// full clone and copy the git history, etc.
//
// This storage layer should only be used for read-only workloads,
// where the entire git history isn't needed.
type worktreeStorer struct {
	storage.Storer // main dotgit where all the objects/refs are
	delta          storer.DeltaObjectStorer
	wtDotgit       storage.Storer // worktree dotgit where the index and HEAD are
}

var _ storage.Storer = (*worktreeStorer)(nil)
var _ storer.DeltaObjectStorer = (*worktreeStorer)(nil)

// DeltaObject implements the storer.DeltaObjectStorer interface for
// worktreeStorer.
func (wts *worktreeStorer) DeltaObject(
	ot plumbing.ObjectType, hash plumbing.Hash) (
	plumbing.EncodedObject, error) {
	return wts.delta.DeltaObject(ot, hash)
}

// SetIndex implements the storer.IndexStorer interface for worktreeStorer.
func (wts *worktreeStorer) SetIndex(in *index.Index) error {
	return wts.wtDotgit.SetIndex(in)
}

// Index implements the storer.IndexStorer interface for worktreeStorer.
func (wts *worktreeStorer) Index() (*index.Index, error) {
	return wts.wtDotgit.Index()
}

// SetReference implements the storer.ReferenceStorer interface for
// worktreeStorer.
func (wts *worktreeStorer) SetReference(ref *plumbing.Reference) error {
	// Steal the hash and set HEAD to it in the worktree, so next time
	// we can read it.
	if ref.Type() != plumbing.HashReference {
		return errors.New("Can't set a non-hash reference")
	}

	headRef := plumbing.NewHashReference(plumbing.HEAD, ref.Hash())
	return wts.wtDotgit.SetReference(headRef)
}

// Reference implements the storer.ReferenceStorer interface for
// worktreeStorer
func (wts *worktreeStorer) Reference(name plumbing.ReferenceName) (
	*plumbing.Reference, error) {
	if name == plumbing.HEAD {
		ref, err := wts.wtDotgit.Reference(name)
		if err == nil {
			return ref, nil
		}
	}
	return wts.Storer.Reference(name)
}
