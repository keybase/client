// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io/ioutil"
	"os"
	"path"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

func testBrowser(t *testing.T, sharedCache sharedInBrowserCache) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, libkbfs.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)

	t.Log("Init a new repo directly into KBFS.")
	dotgitFS, _, err := GetOrCreateRepoAndID(ctx, config, h, "test", "")
	require.NoError(t, err)
	err = rootFS.MkdirAll("worktree", 0600)
	require.NoError(t, err)
	worktreeFS, err := rootFS.Chroot("worktree")
	require.NoError(t, err)
	dotgitStorage, err := NewGitConfigWithoutRemotesStorer(dotgitFS)
	require.NoError(t, err)
	repo, err := gogit.Init(dotgitStorage, worktreeFS)
	require.NoError(t, err)
	addFileToWorktreeAndCommit(
		t, ctx, config, h, repo, worktreeFS, "foo", "hello")
	addFileToWorktreeAndCommit(
		t, ctx, config, h, repo, worktreeFS, "dir/foo", "olleh")

	t.Log("Browse the repo and verify the data.")
	b, err := NewBrowser(dotgitFS, config.Clock(), "", sharedCache)
	require.NoError(t, err)

	if sharedCache != (noopSharedInBrowserCache{}) {
		t.Log("Before anything, cache should be empty")
		_, ok := sharedCache.getFileInfo(b.commitHash, path.Join(b.root, "foo"))
		require.False(t, ok)
	}

	fi, err := b.Stat("foo")
	require.NoError(t, err)
	require.Equal(t, "foo", fi.Name())

	if sharedCache != (noopSharedInBrowserCache{}) {
		t.Log("After a Stat call, make sure cache is populated for foo")
		fi, ok := sharedCache.getFileInfo(
			b.commitHash, path.Join(b.root, "foo"))
		require.True(t, ok)
		require.Equal(t, "foo", fi.Name())
	}

	t.Log("Verify the data in foo.")
	f, err := b.Open("foo")
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))

	fis, err := b.ReadDir("dir")
	require.NoError(t, err)
	require.Len(t, fis, 1)

	if sharedCache != (noopSharedInBrowserCache{}) {
		t.Logf("After a ReadDir, " +
			"make sure cache is populated for dir and dir/foo")
		childrenPaths, ok := sharedCache.getChildrenFileInfos(
			b.commitHash, path.Join(b.root, "dir"))
		require.True(t, ok)
		require.Len(t, childrenPaths, 1)
		require.Equal(t, "foo", childrenPaths[0].Name())
		fi, ok := sharedCache.getFileInfo(
			b.commitHash, path.Join(b.root, "dir", "foo"))
		require.True(t, ok)
		require.Equal(t, "foo", fi.Name())
	}

	t.Log("Use ReadAt with a small buffer.")
	bf, ok := f.(*browserFile)
	require.True(t, ok)
	bf.maxBufSize = 1
	buf := make([]byte, 3)
	n, err := f.ReadAt(buf, 2)
	require.NoError(t, err)
	require.Equal(t, 3, n)
	require.Equal(t, "llo", string(buf))

	addSymlink := func(target, link string) {
		err = worktreeFS.Symlink(target, link)
		require.NoError(t, err)
		wt, err := repo.Worktree()
		require.NoError(t, err)
		_, err = wt.Add(link)
		require.NoError(t, err)
		_, err = wt.Commit("sym commit", &gogit.CommitOptions{
			Author: &object.Signature{
				Name:  "me",
				Email: "me@keyba.se",
				When:  time.Now(),
			},
		})
		require.NoError(t, err)
		b, err = NewBrowser(dotgitFS, config.Clock(), "", sharedCache)
		require.NoError(t, err)
		fi, err := b.Lstat(link)
		require.NoError(t, err)
		require.NotZero(t, fi.Mode()&os.ModeSymlink)
		fi, err = b.Stat(link)
		require.NoError(t, err)
		readTarget, err := b.Readlink(link)
		require.NoError(t, err)
		require.Equal(t, target, readTarget)
		require.Zero(t, fi.Mode()&os.ModeSymlink)
		f2, err := b.Open(link)
		require.NoError(t, err)
		defer f2.Close()
		data, err = ioutil.ReadAll(f2)
		require.NoError(t, err)
		require.Equal(t, "hello", string(data))
	}
	t.Log("Add and read a symlink.")
	addSymlink("foo", "symfoo")

	t.Log("Add and read a second symlink in a chain.")
	err = worktreeFS.MkdirAll("dir", 0700)
	require.NoError(t, err)
	addSymlink("../symfoo", "dir/symfoo")
}

func TestBrowserNoCache(t *testing.T) {
	testBrowser(t, noopSharedInBrowserCache{})
}

func TestBrowserWithCache(t *testing.T) {
	cache, err := newLRUSharedInBrowserCache()
	require.NoError(t, err)
	testBrowser(t, cache)
}
