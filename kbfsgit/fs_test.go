// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"context"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	gogit "gopkg.in/src-d/go-git.v4"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
)

func makeFS(t *testing.T, subdir string) (
	context.Context, *libkbfs.TlfHandle, *libfs.FS) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := libfs.NewFS(ctx, config, h, subdir, "")
	require.NoError(t, err)
	return ctx, h, fs
}

// This tests pushing code to a bare repo stored in KBFS, and pulling
// code from that bare repo into a new working tree.  This is a simple
// version of how the full KBFS Git system will work.  Specifically,
// this test does the following:
//
// 1) Initializes a new repo on the local file system with one file.
// 2) Initializes a new bare repo in KBFS.
// 3) Simulates a user push by having the bare repo fetch from the
//    local file system repo.  (This seems like the easiest way for
//    the git remote helper to get data from the local repo into the
//    server repo.)
// 4) Initializes a second new repo on the local file system.
// 5) Simulates a user pull by having the bare repo push into this
// second repo onto a branch, and then checking out that branch.
func TestBareRepoInKBFS(t *testing.T) {
	ctx, _, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.Config())

	storer, err := newConfigWithoutRemotesStorer(fs)
	require.NoError(t, err)

	repo, err := gogit.Init(storer, nil)
	require.NoError(t, err)
	defer func() {
		err = fs.SyncAll()
		require.NoError(t, err)
	}()

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	t.Logf("Make a new repo in %s with one file", git1)
	err = ioutil.WriteFile(filepath.Join(git1, "foo"), []byte("hello"), 0600)
	require.NoError(t, err)
	dotgit1 := filepath.Join(git1, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit1, "--work-tree", git1, "init")
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit1, "--work-tree", git1, "add", "foo")
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit1, "--work-tree", git1, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "foo")
	err = cmd.Run()
	require.NoError(t, err)

	remote, err := repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: "git1",
		URL:  git1,
	})
	require.NoError(t, err)

	err = remote.Fetch(&gogit.FetchOptions{
		RemoteName: "git1",
		RefSpecs:   []gogitcfg.RefSpec{"refs/heads/master:refs/heads/master"},
	})
	require.NoError(t, err)

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	t.Logf("Make a new repo in %s to clone from the KBFS repo", git2)
	dotgit2 := filepath.Join(git2, ".git")
	cmd = exec.Command(
		"git", "--git-dir", dotgit2, "--work-tree", git2, "init")
	err = cmd.Run()
	require.NoError(t, err)

	remote, err = repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: "git2",
		URL:  git2,
	})
	require.NoError(t, err)

	err = remote.Push(&gogit.PushOptions{
		RemoteName: "git2",
		RefSpecs: []gogitcfg.RefSpec{
			"refs/heads/master:refs/heads/kb/master",
		},
	})
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit2, "--work-tree", git2, "checkout",
		"kb/master")
	err = cmd.Run()
	require.NoError(t, err)

	data, err := ioutil.ReadFile(filepath.Join(git2, "foo"))
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))
}
