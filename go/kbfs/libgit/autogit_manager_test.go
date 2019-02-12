// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	billy "gopkg.in/src-d/go-billy.v4"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

func initConfigForAutogit(t *testing.T) (
	ctx context.Context, config *libkbfs.ConfigLocal,
	cancel context.CancelFunc, tempdir string) {
	ctx = libkbfs.BackgroundContextWithCancellationDelayer()
	config = libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitDefault, "user1", "user2")
	success := false
	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsRepoDir)

	ctx, cancel = context.WithTimeout(ctx, 60*time.Second)

	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		if !success {
			os.RemoveAll(tempdir)
		}
	}()

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)

	success = true
	return ctx, config, cancel, tempdir
}

func addFileToWorktreeAndCommit(
	t *testing.T, ctx context.Context, config libkbfs.Config,
	h *libkbfs.TlfHandle, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data string) {
	addFileToWorktree(t, repo, worktreeFS, name, data)
	commitWorktree(t, ctx, config, h, worktreeFS)
}

func addFileToWorktree(
	t *testing.T, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data string) {
	foo, err := worktreeFS.Create(name)
	require.NoError(t, err)
	defer foo.Close()
	_, err = io.WriteString(foo, data)
	require.NoError(t, err)
	wt, err := repo.Worktree()
	require.NoError(t, err)
	_, err = wt.Add(name)
	require.NoError(t, err)
	_, err = wt.Commit("foo commit", &gogit.CommitOptions{
		Author: &object.Signature{
			Name:  "me",
			Email: "me@keyba.se",
			When:  time.Now(),
		},
	})
	require.NoError(t, err)
}

func commitWorktree(
	t *testing.T, ctx context.Context, config libkbfs.Config,
	h *libkbfs.TlfHandle, worktreeFS billy.Filesystem) {
	err := worktreeFS.(*libfs.FS).SyncAll()
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx,
		rootNode.GetFolderBranch().Tlf, nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)
}
