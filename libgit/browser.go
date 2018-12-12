// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io/ioutil"
	"os"
	"path"
	"strings"
	"time"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
	"gopkg.in/src-d/go-git.v4/storage"
)

func translateGitError(err *error) {
	if *err == nil {
		return
	}
	switch *err {
	case object.ErrEntryNotFound:
		*err = os.ErrNotExist
	default:
		return
	}
}

// Browser presents the contents of a git repo as a read-only file
// system, using only the dotgit directory of the repo.
type Browser struct {
	tree       *object.Tree
	root       string
	mtime      time.Time
	commitHash plumbing.Hash

	sharedCache sharedInBrowserCache
}

var _ billy.Filesystem = (*Browser)(nil)

// NewBrowser makes a new Browser instance, browsing the given branch
// of the given repo.  If `gitBranchName` is empty,
// "refs/heads/master" is used.  If `gitBranchName` is not empty, but
// it doesn't begin with "refs/", then "refs/heads/" is prepended to
// it.
func NewBrowser(
	repoFS *libfs.FS, clock libkbfs.Clock,
	gitBranchName plumbing.ReferenceName,
	sharedCache sharedInBrowserCache) (*Browser, error) {
	var storage storage.Storer
	storage, err := NewGitConfigWithoutRemotesStorer(repoFS)
	if err != nil {
		return nil, err
	}

	repo, err := gogit.Open(storage, nil)
	if errors.Cause(err) == gogit.ErrWorktreeNotProvided {
		// This is not a bare repo (it might be for a test).  So we
		// need to pass in a working tree, but since `Browser` is
		// read-only and doesn't even use the worktree, it doesn't
		// matter what we pass in.
		repo, err = gogit.Open(storage, repoFS)
	}
	if err != nil {
		return nil, err
	}

	if gitBranchName == "" {
		gitBranchName = "refs/heads/master"
	} else if !strings.HasPrefix(string(gitBranchName), "refs/") {
		gitBranchName = "refs/heads/" + gitBranchName
	}

	ref, err := repo.Reference(gitBranchName, true)
	if err != nil {
		return nil, err
	}

	if ref.Type() != plumbing.HashReference {
		return nil, errors.Errorf("can't browse reference type %s", ref.Type())
	}

	c, err := repo.CommitObject(ref.Hash())
	if err != nil {
		return nil, err
	}
	tree, err := c.Tree()
	if err != nil {
		return nil, err
	}

	return &Browser{
		tree:        tree,
		root:        string(gitBranchName),
		mtime:       c.Author.When,
		commitHash:  c.Hash,
		sharedCache: sharedCache,
	}, nil
}

///// Read-only functions:

const (
	maxSymlinkLevels = 40 // same as Linux
)

func (b *Browser) readLink(filename string) (string, error) {
	f, err := b.tree.File(filename)
	if err != nil {
		return "", err
	}
	r, err := f.Reader()
	if err != nil {
		return "", err
	}
	defer r.Close()
	data, err := ioutil.ReadAll(r)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (b *Browser) followSymlink(filename string) (string, error) {
	// Otherwise, resolve the symlink and return the underlying FileInfo.
	link, err := b.readLink(filename)
	if err != nil {
		return "", err
	}
	if path.IsAbs(link) {
		return "", errors.Errorf("can't follow absolute link: %s", link)
	}

	parts := strings.Split(filename, "/")
	var parentPath string
	if len(parts) > 0 {
		parentPath = path.Join(parts[:len(parts)-1]...)
	}
	newPath := path.Clean(path.Join(parentPath, link))
	if strings.HasPrefix(newPath, "..") {
		return "", errors.Errorf(
			"cannot follow symlink out of chroot: %s", newPath)
	}
	return newPath, nil
}

// Open implements the billy.Filesystem interface for Browser.
func (b *Browser) Open(filename string) (f billy.File, err error) {
	defer translateGitError(&err)
	for i := 0; i < maxSymlinkLevels; i++ {
		fi, err := b.Lstat(filename)
		if err != nil {
			return nil, err
		}

		// If it's not a symlink, we can return right away.
		if fi.Mode()&os.ModeSymlink == 0 {
			f, err := b.tree.File(filename)
			if err != nil {
				return nil, err
			}
			return newBrowserFile(f)
		}

		filename, err = b.followSymlink(filename)
		if err != nil {
			return nil, err
		}
	}
	return nil, errors.New("cannot resolve deep symlink chain")
}

// OpenFile implements the billy.Filesystem interface for Browser.
func (b *Browser) OpenFile(filename string, flag int, _ os.FileMode) (
	f billy.File, err error) {
	if flag&os.O_CREATE != 0 {
		return nil, errors.New("browser can't create files")
	}

	return b.Open(filename)
}

// Lstat implements the billy.Filesystem interface for Browser.
func (b *Browser) Lstat(filename string) (fi os.FileInfo, err error) {
	cachePath := path.Join(b.root, filename)
	if fi, ok := b.sharedCache.getFileInfo(b.commitHash, cachePath); ok {
		return fi, nil
	}
	defer translateGitError(&err)
	entry, err := b.tree.FindEntry(filename)
	if err != nil {
		return nil, err
	}

	size, err := b.tree.Size(filename)
	if err != nil {
		return nil, err
	}

	// Git doesn't keep track of the mtime of individual files
	// anywhere, so just use the timestamp from the commit.
	fi = &browserFileInfo{entry, size, b.mtime}

	b.sharedCache.setFileInfo(b.commitHash, cachePath, fi)

	return fi, nil
}

// Stat implements the billy.Filesystem interface for Browser.
func (b *Browser) Stat(filename string) (fi os.FileInfo, err error) {
	defer translateGitError(&err)
	for i := 0; i < maxSymlinkLevels; i++ {
		fi, err := b.Lstat(filename)
		if err != nil {
			return nil, err
		}
		// If it's not a symlink, we can return right away.
		if fi.Mode()&os.ModeSymlink == 0 {
			return fi, nil
		}

		filename, err = b.followSymlink(filename)
		if err != nil {
			return nil, err
		}
	}
	return nil, errors.New("cannot resolve deep symlink chain")
}

// Join implements the billy.Filesystem interface for Browser.
func (b *Browser) Join(elem ...string) string {
	return path.Clean(path.Join(elem...))
}

// ReadDir implements the billy.Filesystem interface for Browser.
func (b *Browser) ReadDir(p string) (fis []os.FileInfo, err error) {
	if p == "" {
		p = "."
	}

	cachePath := path.Join(b.root, p)

	if fis, ok := b.sharedCache.getChildrenFileInfos(
		b.commitHash, cachePath); ok {
		return fis, nil
	}

	defer translateGitError(&err)
	var dirTree *object.Tree
	if p == "." {
		dirTree = b.tree
	} else {
		dirTree, err = b.tree.Tree(p)
		if err != nil {
			return nil, err
		}
	}

	childrenPathsToCache := make([]string, 0, len(dirTree.Entries))
	for _, e := range dirTree.Entries {
		fi, err := b.Lstat(path.Join(p, e.Name))
		if err != nil {
			return nil, err
		}
		fis = append(fis, fi)
		childrenPathsToCache = append(childrenPathsToCache, path.Join(cachePath, e.Name))
	}
	b.sharedCache.setChildrenPaths(
		b.commitHash, cachePath, childrenPathsToCache)

	return fis, nil
}

// Readlink implements the billy.Filesystem interface for Browser.
func (b *Browser) Readlink(link string) (target string, err error) {
	defer translateGitError(&err)
	fi, err := b.Lstat(link)
	if err != nil {
		return "", err
	}
	// If it's not a symlink, error right away.
	if fi.Mode()&os.ModeSymlink == 0 {
		return "", errors.New("not a symlink")
	}

	return b.readLink(link)
}

// Chroot implements the billy.Filesystem interface for Browser.
func (b *Browser) Chroot(p string) (newFS billy.Filesystem, err error) {
	defer translateGitError(&err)
	newTree, err := b.tree.Tree(p)
	if err != nil {
		return nil, err
	}
	return &Browser{
		tree:        newTree,
		root:        b.Join(b.root, p),
		mtime:       b.mtime,
		commitHash:  b.commitHash,
		sharedCache: b.sharedCache,
	}, nil
}

// Root implements the billy.Filesystem interface for Browser.
func (b *Browser) Root() string {
	return b.root
}

///// Modifying functions (not supported):

// Create implements the billy.Filesystem interface for Browser.
func (b *Browser) Create(_ string) (billy.File, error) {
	return nil, errors.New("browser cannot create files")
}

// Rename implements the billy.Filesystem interface for Browser.
func (b *Browser) Rename(_, _ string) (err error) {
	return errors.New("browser cannot rename files")
}

// Remove implements the billy.Filesystem interface for Browser.
func (b *Browser) Remove(_ string) (err error) {
	return errors.New("browser cannot remove files")
}

// TempFile implements the billy.Filesystem interface for Browser.
func (b *Browser) TempFile(_, _ string) (billy.File, error) {
	return nil, errors.New("browser cannot make temp files")
}

// MkdirAll implements the billy.Filesystem interface for Browser.
func (b *Browser) MkdirAll(_ string, _ os.FileMode) (err error) {
	return errors.New("browser cannot mkdir")
}

// Symlink implements the billy.Filesystem interface for Browser.
func (b *Browser) Symlink(_, _ string) (err error) {
	return errors.New("browser cannot make symlinks")
}
