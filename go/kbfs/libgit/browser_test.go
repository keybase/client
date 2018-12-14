// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io/ioutil"
	"os"
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

func TestBrowser(t *testing.T) {
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

	t.Log("Browse the repo and verify the data.")
	b, err := NewBrowser(dotgitFS, config.Clock(), "")
	require.NoError(t, err)
	fis, err := b.ReadDir("")
	require.NoError(t, err)
	require.Len(t, fis, 1)
	f, err := b.Open("foo")
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))

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
		b, err = NewBrowser(dotgitFS, config.Clock(), "")
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
