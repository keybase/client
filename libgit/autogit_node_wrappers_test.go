// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	gogit "gopkg.in/src-d/go-git.v4"
)

func TestAutogitNodeWrappers(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	kbCtx := env.NewContext()
	kbfsInitParams := libkbfs.DefaultInitParams(kbCtx)
	shutdown := startAutogit(kbCtx, config, &kbfsInitParams, 1)
	defer shutdown()

	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)

	t.Log("Looking at user1's autogit directory should succeed, and " +
		"autocreate all the necessary directories")
	fis, err := rootFS.ReadDir(rootFS.Join(autogitRoot, private, "user1"))
	require.NoError(t, err)
	require.Len(t, fis, 0)
	fis, err = rootFS.ReadDir(rootFS.Join(autogitRoot, public, "user1"))
	require.NoError(t, err)
	require.Len(t, fis, 0)

	t.Log("Looking up a non-existent user won't work")
	_, err = rootFS.ReadDir(rootFS.Join(autogitRoot, private, "user2"))
	require.NotNil(t, err)

	t.Log("Looking up the wrong TLF type won't work")
	_, err = rootFS.ReadDir(rootFS.Join(autogitRoot, "faketlftype", "user1"))
	require.NotNil(t, err)

	t.Log("Other autocreates in the root won't work")
	_, err = rootFS.ReadDir("a")
	require.NotNil(t, err)
}

func TestAutogitRepoNode(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	kbCtx := env.NewContext()
	kbfsInitParams := libkbfs.DefaultInitParams(kbCtx)
	am := NewAutogitManager(config, kbCtx, &kbfsInitParams, 1)
	defer am.Shutdown()
	nc := &newConfigger{config: config, user: "user1"}
	am.getNewConfig = nc.getNewConfigForTest
	rw := rootWrapper{am}
	config.AddRootNodeWrapper(rw.wrap)

	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "user1", tlf.Public)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, "", "", keybase1.MDPriorityNormal)
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

	t.Log("Use autogit to clone it using ReadDir")
	checkAutogit := func(rootFS *libfs.FS) {
		fis, err := rootFS.ReadDir(".kbfs_autogit/public/user1/test")
		require.NoError(t, err)
		require.Len(t, fis, 2) // foo and .git
		f, err := rootFS.Open(".kbfs_autogit/public/user1/test/foo")
		require.NoError(t, err)
		defer f.Close()
		data, err := ioutil.ReadAll(f)
		require.NoError(t, err)
		require.Equal(t, "hello", string(data))
	}
	checkAutogit(rootFS)

	t.Log("Use autogit to open it in another user's TLF")
	nc2 := &newConfigger{config: config, user: "user2"}
	ctx2 := libkbfs.NewContextReplayable(
		context.Background(), func(c context.Context) context.Context {
			return c
		})
	ctx2, config2, tempdir2, err := nc2.getNewConfigForTest(ctx2)
	require.NoError(t, err)
	defer libkbfs.CheckConfigAndShutdown(ctx2, t, config2)
	defer os.RemoveAll(tempdir2)
	am2 := NewAutogitManager(config2, kbCtx, &kbfsInitParams, 1)
	defer am2.Shutdown()
	am2.getNewConfig = nc2.getNewConfigForTest
	rw2 := rootWrapper{am2}
	config2.AddRootNodeWrapper(rw2.wrap)

	h2, err := libkbfs.ParseTlfHandle(
		ctx2, config2.KBPKI(), config2.MDOps(), "user2", tlf.Private)
	require.NoError(t, err)
	rootFS2, err := libfs.NewFS(
		ctx2, config2, h2, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	checkAutogit(rootFS2)
}
